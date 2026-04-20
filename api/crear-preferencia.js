const supabase = require("./_lib/supabase");
const { preferenceApi } = require("./_lib/mp");
const { handleCors } = require("./_lib/cors");

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { pago_id } = req.body;
  if (!pago_id || isNaN(Number(pago_id))) return res.status(400).json({ error: "pago_id inválido" });

  try {
    const { data: pago, error: pagoErr } = await supabase
      .from("pagos")
      .select(`id, monto_clp, estado, suscripcion:suscripciones(id, user_id, plan:planes(nombre))`)
      .eq("id", Number(pago_id))
      .in("estado", ["pendiente", "en_gracia"])
      .single();

    if (pagoErr || !pago) return res.status(404).json({ error: "Pago no encontrado o ya procesado" });

    const monto      = pago.monto_clp;
    const planNombre = pago.suscripcion?.plan?.nombre || "Suscripción POS-Matic";
    const landingUrl = process.env.LANDING_URL;
    const backendUrl = process.env.BACKEND_URL;

    const preference = await preferenceApi.create({
      body: {
        items: [{ title: `${planNombre} - POS-Matic`, quantity: 1, unit_price: monto, currency_id: "CLP" }],
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

    await supabase.from("pagos").update({ mp_preference_id: preference.id }).eq("id", pago.id);

    res.json({ init_point: preference.init_point, preference_id: preference.id, monto });
  } catch (err) {
    console.error("Error creando preferencia:", err.message);
    res.status(500).json({ error: "Error al crear preferencia de pago" });
  }
};
