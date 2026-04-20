const { handleCors } = require("./_lib/cors");
const { preferenceApi } = require("./_lib/mp");
const { fetchUFDirecto } = require("./_lib/helpers");
const supabase = require("./_lib/supabase");

const PLANES = {
  basico:   { nombre: "Plan Básico",   uf: 0.7 },
  estandar: { nombre: "Plan Estándar", uf: 1.4 },
  pro:      { nombre: "Plan Pro",      uf: 2.0 },
};

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { plan: planSlug } = req.body;
  const plan = PLANES[planSlug] || PLANES.basico;

  try {
    let uf = null;
    try { const { data } = await supabase.rpc("get_uf_actual"); uf = data; } catch {}
    if (!uf) uf = await fetchUFDirecto();
    if (!uf) return res.status(503).json({ error: "No se pudo obtener el valor de la UF" });

    const monto = Math.round(plan.uf * uf);
    const landingUrl = process.env.LANDING_URL;
    const backendUrl = process.env.BACKEND_URL;

    const preference = await preferenceApi.create({
      body: {
        items: [{ title: `${plan.nombre} - POS-Matic`, quantity: 1, unit_price: monto, currency_id: "CLP" }],
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

    res.json({ init_point: preference.init_point, sandbox_init_point: preference.sandbox_init_point, monto });
  } catch (err) {
    console.error("Error create-preference:", err.message);
    res.status(500).json({ error: "Error al crear preferencia de pago" });
  }
};
