const supabase = require("./_lib/supabase");
const { preferenceApi } = require("./_lib/mp");
const { handleCors } = require("./_lib/cors");
const { fetchUFDirecto } = require("./_lib/helpers");

const PLANES_LEGACY = {
  basico:   { nombre: "Plan Básico",   uf: 0.7 },
  estandar: { nombre: "Plan Estándar", uf: 1.4 },
  pro:      { nombre: "Plan Pro",      uf: 2.0 },
};

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { user_id, plan_slug = "basico" } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id requerido" });

  const plan = PLANES_LEGACY[plan_slug];
  if (!plan) return res.status(400).json({ error: "plan inválido" });

  try {
    let uf = null;
    try { const { data } = await supabase.rpc("get_uf_actual"); uf = data; } catch {}
    if (!uf) uf = await fetchUFDirecto();
    if (!uf) return res.status(503).json({ error: "No se pudo obtener el valor de la UF" });

    const TEST_ACCOUNTS_CLP = { "a@a.cl": 300 };
    const { data: perfil } = await supabase.from("profiles").select("email").eq("id", user_id).single();
    const montoTest = perfil?.email && TEST_ACCOUNTS_CLP[perfil.email];
    const monto = montoTest || Math.round(plan.uf * uf);
    const landingUrl = process.env.LANDING_URL;
    const backendUrl = process.env.BACKEND_URL;

    const preference = await preferenceApi.create({
      body: {
        items: [{ title: `${plan.nombre} - POS-Matic`, quantity: 1, unit_price: monto, currency_id: "CLP" }],
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
    console.error("Error pago-legacy:", err.message, err.cause);
    res.status(500).json({ error: "Error creando preferencia de pago", _debug: err.message, _cause: String(err.cause || "") });
  }
};
