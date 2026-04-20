const supabase = require("./_lib/supabase");
const { preferenceApi } = require("./_lib/mp");
const { handleCors } = require("./_lib/cors");

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { user_id, plan_slug } = req.body;
  if (!user_id || !plan_slug) return res.status(400).json({ error: "user_id y plan_slug son requeridos" });

  try {
    const { data: plan, error: planErr } = await supabase
      .from("planes").select("id, nombre, slug, uf_cantidad")
      .eq("slug", plan_slug).eq("activo", true).single();

    if (planErr || !plan) return res.status(404).json({ error: "Plan no encontrado" });

    const { data: uf } = await supabase.rpc("get_uf_actual");
    const monto = Math.round(plan.uf_cantidad * uf);

    let { data: sub } = await supabase.from("suscripciones").select("id").eq("user_id", user_id).single();
    if (!sub) {
      const { data: newSub, error: subErr } = await supabase
        .from("suscripciones").insert({ user_id, plan_id: plan.id, estado: "pendiente" }).select("id").single();
      if (subErr) throw subErr;
      sub = newSub;
    }

    const landingUrl = process.env.LANDING_URL;
    const backendUrl = process.env.BACKEND_URL;

    const preference = await preferenceApi.create({
      body: {
        items: [{ title: `${plan.nombre} - POS-Matic`, quantity: 1, unit_price: monto, currency_id: "CLP" }],
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

    const { data: result, error: pagoErr } = await supabase.rpc("crear_pago_pendiente", {
      p_user_id: user_id, p_preference_id: preference.id, p_plan_slug: plan_slug,
    });

    if (pagoErr) throw pagoErr;
    if (!result?.ok) return res.status(500).json({ error: result?.error || "Error creando pago" });

    res.json({ init_point: preference.init_point, pago_id: result.pago_id, monto: result.monto_clp });
  } catch (err) {
    console.error("Error suscribirse:", err.message);
    res.status(500).json({ error: "Error al procesar la suscripción" });
  }
};
