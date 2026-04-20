const supabase = require("../_lib/supabase");
const { handleCors } = require("../_lib/cors");
const { sanitizeProfile, verificarHcaptcha } = require("../_lib/helpers");

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { email, hcaptcha_token } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Debes ingresar un email válido" });

  if (process.env.HCAPTCHA_SECRET) {
    const ok = await verificarHcaptcha(hcaptcha_token);
    if (!ok) return res.status(400).json({ error: "Captcha inválido, intenta de nuevo" });
  }

  try {
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, email, nombre_completo, nombre_negocio, subscription_status, subscription_end_date, auth_status")
      .eq("email", email.trim().toLowerCase())
      .limit(1);

    if (profErr) throw profErr;
    if (!profiles || profiles.length === 0) return res.status(404).json({ error: "No se encontró ninguna cuenta con ese email" });

    const profile = profiles[0];

    const { data: subs, error: subErr } = await supabase
      .from("suscripciones")
      .select("id, estado, proximo_cobro, plan:planes(id, nombre, uf_cantidad)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!subErr && subs && subs.length > 0) {
      const sub = subs[0];
      const { data: pagos } = await supabase
        .from("pagos")
        .select("id, monto_clp, estado, periodo_cobrado, created_at")
        .eq("suscripcion_id", sub.id)
        .in("estado", ["pendiente", "en_gracia"])
        .order("created_at", { ascending: false });

      return res.json({
        tiene_suscripcion: true, sistema: "nuevo",
        profile: sanitizeProfile(profile),
        suscripcion: { id: sub.id, estado: sub.estado, plan: sub.plan, proximo_cobro: sub.proximo_cobro },
        pagos_pendientes: pagos || [],
      });
    }

    const suspendida = profile.subscription_status === "suspended" ||
                       profile.auth_status === "suspended" ||
                       (profile.subscription_end_date && new Date(profile.subscription_end_date) < new Date());

    return res.json({
      tiene_suscripcion: true, sistema: "legacy",
      profile: sanitizeProfile(profile),
      suscripcion: {
        id: null,
        estado: suspendida ? "bloqueada" : "activa",
        plan: { nombre: "POS-Matic" },
        proximo_cobro: profile.subscription_end_date,
      },
      pagos_pendientes: suspendida ? [{
        id: "legacy-" + profile.id, monto_clp: null, estado: "pendiente",
        periodo_cobrado: new Date().toISOString().slice(0, 7), es_legacy: true,
      }] : [],
    });
  } catch (err) {
    console.error("Error estado cuenta:", err.message);
    res.status(500).json({ error: "Error consultando cuenta" });
  }
};
