const express = require("express");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

// ─── Clientes externos (lazy para no crashear si faltan variables) ─────────────
function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}
let _supa = null;
const supabase = new Proxy({}, {
  get: (_, prop) => {
    if (!_supa) _supa = getSupabase();
    return _supa[prop];
  }
});

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || "TEST",
});
const preferenceApi = new Preference(mpClient);
const paymentApi   = new Payment(mpClient);

// ─── GET /api/uf ──────────────────────────────────────────────────────────────
// Devuelve el valor actual de la UF (con caché en BD)
app.get("/api/uf", async (req, res) => {
  try {
    const { data, error } = await supabase.rpc("get_uf_actual");
    if (error) throw error;
    res.json({ uf: data });
  } catch (err) {
    console.error("Error obteniendo UF:", err.message);
    res.status(500).json({ error: "No se pudo obtener el valor de la UF" });
  }
});

// ─── GET /api/planes ──────────────────────────────────────────────────────────
// Devuelve los planes con precio en CLP calculado desde la UF del día
app.get("/api/planes", async (req, res) => {
  try {
    const [{ data: uf, error: ufErr }, { data: planes, error: plErr }] = await Promise.all([
      supabase.rpc("get_uf_actual"),
      supabase.from("planes").select("*").eq("activo", true).order("precio_uf"),
    ]);
    if (ufErr) throw ufErr;
    if (plErr) throw plErr;

    const resultado = planes.map((p) => ({
      ...p,
      precio_clp: Math.round(p.uf_cantidad * uf),
      uf_valor: uf,
    }));
    res.json({ planes: resultado, uf });
  } catch (err) {
    console.error("Error obteniendo planes:", err.message);
    res.status(500).json({ error: "No se pudo obtener los planes" });
  }
});

// ─── POST /api/cuenta/estado ──────────────────────────────────────────────────
// Busca la cuenta por email y devuelve suscripción + pagos pendientes
app.post("/api/cuenta/estado", async (req, res) => {
  const { email, hcaptcha_token } = req.body;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Debes ingresar un email válido" });
  }

  // Verificar hCaptcha si está configurado
  if (process.env.HCAPTCHA_SECRET) {
    const ok = await verificarHcaptcha(hcaptcha_token);
    if (!ok) {
      return res.status(400).json({ error: "Captcha inválido, intenta de nuevo" });
    }
  }

  try {
    // Buscar perfil por email (columnas del esquema real de pos-matic)
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, email, nombre_completo, nombre_negocio, subscription_status, subscription_end_date, auth_status")
      .eq("email", email.trim().toLowerCase())
      .limit(1);

    if (profErr) throw profErr;
    if (!profiles || profiles.length === 0) {
      return res.status(404).json({ error: "No se encontró ninguna cuenta con ese email" });
    }
    const profile = profiles[0];

    // Intentar sistema nuevo (suscripciones/pagos) — si no existe, fallback al legacy
    const { data: subs, error: subErr } = await supabase
      .from("suscripciones")
      .select("id, estado, proximo_cobro, plan:planes(id, nombre, uf_cantidad)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1);

    // ── Sistema nuevo disponible ──────────────────────────────────
    if (!subErr && subs && subs.length > 0) {
      const sub = subs[0];
      const { data: pagos } = await supabase
        .from("pagos")
        .select("id, monto_clp, estado, periodo_cobrado, created_at")
        .eq("suscripcion_id", sub.id)
        .in("estado", ["pendiente", "en_gracia"])
        .order("created_at", { ascending: false });

      return res.json({
        tiene_suscripcion: true,
        sistema: "nuevo",
        profile: sanitizeProfile(profile),
        suscripcion: { id: sub.id, estado: sub.estado, plan: sub.plan, proximo_cobro: sub.proximo_cobro },
        pagos_pendientes: pagos || [],
      });
    }

    // ── Fallback: sistema legacy (subscription_status en profiles) ─
    const suspendida = profile.subscription_status === "suspended" ||
                       profile.auth_status === "suspended" ||
                       (profile.subscription_end_date && new Date(profile.subscription_end_date) < new Date());

    return res.json({
      tiene_suscripcion: true,
      sistema: "legacy",
      profile: sanitizeProfile(profile),
      suscripcion: {
        id: null,
        estado: suspendida ? "bloqueada" : "activa",
        plan: { nombre: "POS-Matic" },
        proximo_cobro: profile.subscription_end_date,
      },
      // Si está suspendida, mostrar un pago pendiente simbólico
      pagos_pendientes: suspendida ? [{
        id: "legacy-" + profile.id,
        monto_clp: null,
        estado: "pendiente",
        periodo_cobrado: new Date().toISOString().slice(0, 7),
        es_legacy: true,
      }] : [],
    });

  } catch (err) {
    console.error("Error estado cuenta:", err.message);
    res.status(500).json({ error: "Error consultando cuenta" });
  }
});

// ─── POST /api/crear-preferencia ─────────────────────────────────────────────
// Crea preferencia de pago en MercadoPago para un pago_id existente.
// El monto SIEMPRE viene de la BD — el frontend nunca envía precios.
app.post("/api/crear-preferencia", async (req, res) => {
  const { pago_id } = req.body;

  if (!pago_id || isNaN(Number(pago_id))) {
    return res.status(400).json({ error: "pago_id inválido" });
  }

  try {
    // Cargar el pago con info del plan desde BD
    const { data: pago, error: pagoErr } = await supabase
      .from("pagos")
      .select(`
        id, monto_clp, estado,
        suscripcion:suscripciones(
          id, user_id,
          plan:planes(nombre)
        )
      `)
      .eq("id", Number(pago_id))
      .in("estado", ["pendiente", "en_gracia"])
      .single();

    if (pagoErr || !pago) {
      return res.status(404).json({ error: "Pago no encontrado o ya procesado" });
    }

    const monto      = pago.monto_clp;
    const planNombre = pago.suscripcion?.plan?.nombre || "Suscripción POS-Matic";
    const landingUrl = process.env.LANDING_URL || "http://localhost:8080";
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;

    const preference = await preferenceApi.create({
      body: {
        items: [
          {
            title: `${planNombre} - POS-Matic`,
            quantity: 1,
            unit_price: monto,
            currency_id: "CLP",
          },
        ],
        // external_reference = pago_id para trazar; el webhook también usa mp_preference_id
        external_reference: `pago_${pago.id}`,
        back_urls: {
          success: `${landingUrl}/pagar.html?pago=exitoso`,
          failure: `${landingUrl}/pagar.html?pago=fallido`,
          pending: `${landingUrl}/pagar.html?pago=pendiente`,
        },
        notification_url: `${backendUrl}/api/webhook/mp`,
        statement_descriptor: "POS-Matic Pudu",
        payment_methods: { installments: 1 },
      },
    });

    // Guardar preference_id en la BD
    await supabase
      .from("pagos")
      .update({ mp_preference_id: preference.id })
      .eq("id", pago.id);

    res.json({
      init_point: preference.init_point,
      preference_id: preference.id,
      monto,
    });
  } catch (err) {
    console.error("Error creando preferencia:", err.message);
    res.status(500).json({ error: "Error al crear preferencia de pago" });
  }
});

// ─── POST /api/webhook/mp ─────────────────────────────────────────────────────
// MercadoPago notifica aquí cuando cambia el estado de un pago.
// Se responde 200 inmediatamente y se procesa de forma asíncrona.
app.post("/api/webhook/mp", async (req, res) => {
  res.sendStatus(200); // MP requiere respuesta rápida

  try {
    const xSignature  = req.headers["x-signature"]  || "";
    const xRequestId  = req.headers["x-request-id"] || "";
    const dataId      = req.query["data.id"] || req.body?.data?.id;

    // Verificar firma HMAC si el secreto está configurado
    if (process.env.MP_WEBHOOK_SECRET && xSignature && dataId) {
      const parts = Object.fromEntries(
        xSignature.split(",").map((p) => p.trim().split("="))
      );
      const ts = parts.ts || "";
      const v1 = parts.v1 || "";
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const hash = crypto
        .createHmac("sha256", process.env.MP_WEBHOOK_SECRET)
        .update(manifest)
        .digest("hex");
      if (hash !== v1) {
        console.error("Webhook MP: firma inválida — descartado");
        return;
      }
    }

    const { type, data } = req.body || {};
    if (type !== "payment") return;

    const paymentId = data?.id;
    if (!paymentId) return;

    // Consultar el pago en la API de MercadoPago
    const payment = await paymentApi.get({ id: String(paymentId) });
    const { status, transaction_amount, external_reference } = payment;

    if (!external_reference) {
      console.error("Webhook MP: sin external_reference");
      return;
    }

    // ── Pago legacy (cuentas sin tablas nuevas) ───────────────────────────────
    if (external_reference.startsWith("legacy:")) {
      const [, userId, planSlug] = external_reference.split(":");
      if (status === "approved") {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        const { error: upErr } = await supabase
          .from("profiles")
          .update({
            subscription_status: "active",
            auth_status: "active",
            subscription_end_date: endDate.toISOString(),
          })
          .eq("id", userId);
        if (upErr) console.error("Webhook legacy: error activando perfil:", upErr.message);
        else console.log(`Webhook legacy: perfil ${userId} activado 30 días (plan ${planSlug})`);
      }
      return;
    }

    // ── Pago sistema nuevo ────────────────────────────────────────────────────
    const pagoId = parseInt(external_reference.replace("pago_", ""), 10);
    if (!pagoId || isNaN(pagoId)) {
      console.error("Webhook MP: external_reference inválido:", external_reference);
      return;
    }

    const { data: pagoRow } = await supabase
      .from("pagos")
      .select("mp_preference_id")
      .eq("id", pagoId)
      .single();

    const { error } = await supabase.rpc("procesar_pago_mp", {
      p_mp_payment_id:  String(paymentId),
      p_mp_status:      status,
      p_monto_recibido: Math.round(transaction_amount),
      p_preference_id:  pagoRow?.mp_preference_id || null,
    });

    if (error) {
      console.error(`Webhook MP: procesar_pago_mp falló para pago ${paymentId}:`, error.message);
    } else {
      console.log(`Webhook MP: pago ${paymentId} procesado OK (estado: ${status})`);
    }
  } catch (err) {
    console.error("Webhook MP: error inesperado:", err.message);
  }
});

// ─── POST /api/suscribirse ────────────────────────────────────────────────────
// Para NUEVOS suscriptores desde la landing page.
// Requiere que el usuario ya tenga cuenta en Supabase (user_id del JWT).
// Crea la suscripción, calcula monto desde UF, crea preferencia MP y
// llama a crear_pago_pendiente con el preference_id (orden correcto para FK).
app.post("/api/suscribirse", async (req, res) => {
  const { user_id, plan_slug } = req.body;

  if (!user_id || !plan_slug) {
    return res.status(400).json({ error: "user_id y plan_slug son requeridos" });
  }

  try {
    // 1. Verificar plan
    const { data: plan, error: planErr } = await supabase
      .from("planes")
      .select("id, nombre, slug, uf_cantidad")
      .eq("slug", plan_slug)
      .eq("activo", true)
      .single();

    if (planErr || !plan) {
      return res.status(404).json({ error: "Plan no encontrado" });
    }

    // 2. Obtener UF actual y calcular monto
    const { data: uf } = await supabase.rpc("get_uf_actual");
    const monto = Math.round(plan.uf_cantidad * uf);

    // 3. Verificar/crear suscripción
    let { data: sub } = await supabase
      .from("suscripciones")
      .select("id")
      .eq("user_id", user_id)
      .single();

    if (!sub) {
      const { data: newSub, error: subErr } = await supabase
        .from("suscripciones")
        .insert({ user_id, plan_id: plan.id, estado: "pendiente" })
        .select("id")
        .single();
      if (subErr) throw subErr;
      sub = newSub;
    }

    const landingUrl = process.env.LANDING_URL || "http://localhost:8080";
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;

    // 4. Crear preferencia MP (el monto nunca viene del frontend)
    const preference = await preferenceApi.create({
      body: {
        items: [
          {
            title: `${plan.nombre} - POS-Matic`,
            quantity: 1,
            unit_price: monto,
            currency_id: "CLP",
          },
        ],
        external_reference: `sub_${sub.id}`,
        back_urls: {
          success: `${landingUrl}/pagar.html?pago=exitoso`,
          failure: `${landingUrl}/pagar.html?pago=fallido`,
          pending: `${landingUrl}/pagar.html?pago=pendiente`,
        },
        notification_url: `${backendUrl}/api/webhook/mp`,
        statement_descriptor: "POS-Matic Pudu",
        payment_methods: { installments: 1 },
      },
    });

    // 5. Registrar pago en BD con el preference_id ya conocido
    const { data: result, error: pagoErr } = await supabase.rpc("crear_pago_pendiente", {
      p_user_id:       user_id,
      p_preference_id: preference.id,
      p_plan_slug:     plan_slug,
    });

    if (pagoErr) throw pagoErr;
    if (!result?.ok) {
      return res.status(500).json({ error: result?.error || "Error creando pago" });
    }

    res.json({
      init_point: preference.init_point,
      pago_id:    result.pago_id,
      monto:      result.monto_clp,
    });
  } catch (err) {
    console.error("Error suscribirse:", err.message);
    res.status(500).json({ error: "Error al procesar la suscripción" });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sanitizeProfile(p) {
  return {
    id: p.id,
    email: p.email,
    nombre: p.nombre_completo || p.nombre_negocio || p.email,
    negocio: p.nombre_negocio,
    activa: p.suscripcion_activa ?? (p.subscription_status === "active"),
  };
}

async function verificarHcaptcha(token) {
  if (!token) return false;
  try {
    const params = new URLSearchParams({
      response: token,
      secret: process.env.HCAPTCHA_SECRET,
    });
    const r = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      body: params,
    });
    const json = await r.json();
    return json.success === true;
  } catch {
    return false;
  }
}

// ─── GET /api/uf-directo ──────────────────────────────────────────────────────
// Obtiene UF desde mindicador.cl sin pasar por BD (fallback cuando no hay caché)
async function fetchUFDirecto() {
  const r = await fetch("https://mindicador.cl/api/uf");
  const json = await r.json();
  return json.serie?.[0]?.valor ?? null;
}

// ─── GET /api/uf-preview?uf=0.7 ──────────────────────────────────────────────
// Calcula monto en CLP para N UF usando el valor del día (sin autenticación)
app.get("/api/uf-preview", async (req, res) => {
  const ufCantidad = parseFloat(req.query.uf);
  if (!ufCantidad || isNaN(ufCantidad)) return res.status(400).json({ error: "uf inválido" });
  try {
    let uf = null;
    try { const { data } = await supabase.rpc("get_uf_actual"); uf = data; } catch {}
    if (!uf) uf = await fetchUFDirecto();
    if (!uf) return res.status(503).json({ error: "Sin UF disponible" });
    res.json({ uf, monto: Math.round(ufCantidad * uf), uf_cantidad: ufCantidad });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/pago-legacy ────────────────────────────────────────────────────
// Crea preferencia MP para cuentas sin tablas de suscripción nuevas.
// El plan y precio siempre vienen del servidor, nunca del frontend.
const PLANES_LEGACY = {
  basico:   { nombre: "Plan Básico",    uf: 0.7 },
  estandar: { nombre: "Plan Estándar",  uf: 1.4 },
  pro:      { nombre: "Plan Pro",       uf: 2.0 },
};

app.post("/api/pago-legacy", async (req, res) => {
  const { user_id, plan_slug = "basico" } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id requerido" });

  const plan = PLANES_LEGACY[plan_slug];
  if (!plan) return res.status(400).json({ error: "plan inválido" });

  try {
    // Obtener UF: primero intenta caché BD, si falla usa mindicador.cl directo
    let uf = null;
    try {
      const { data } = await supabase.rpc("get_uf_actual");
      uf = data;
    } catch {}
    if (!uf) uf = await fetchUFDirecto();
    if (!uf) return res.status(503).json({ error: "No se pudo obtener el valor de la UF" });

    // Cuentas de prueba usan monto fijo de 300 CLP
    const TEST_ACCOUNTS_CLP = { "a@a.cl": 300 };
    const { data: perfil } = await supabase.from("profiles").select("email").eq("id", user_id).single();
    const montoTest = perfil?.email && TEST_ACCOUNTS_CLP[perfil.email];
    const monto = montoTest || Math.round(plan.uf * uf);
    const landingUrl = process.env.LANDING_URL || "http://localhost:8080";
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;

    const preference = await preferenceApi.create({
      body: {
        items: [{
          title: `${plan.nombre} - POS-Matic`,
          quantity: 1,
          unit_price: monto,
          currency_id: "CLP",
        }],
        external_reference: `legacy:${user_id}:${plan_slug}`,
        back_urls: {
          success: `${landingUrl}/pagar.html?pago=exitoso`,
          failure: `${landingUrl}/pagar.html?pago=fallido`,
          pending: `${landingUrl}/pagar.html?pago=pendiente`,
        },
        notification_url: `${backendUrl}/api/webhook/mp`,
        statement_descriptor: "POS-Matic Pudu",
        payment_methods: { installments: 1 },
      },
    });

    res.json({ init_point: preference.init_point, monto, uf, plan: plan.nombre });
  } catch (err) {
    console.error("Error pago-legacy:", err.message);
    res.status(500).json({ error: "Error creando preferencia de pago" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor POS-Matic corriendo en http://localhost:${PORT}`);
});
