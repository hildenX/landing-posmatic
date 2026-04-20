const crypto = require("crypto");
const supabase = require("../_lib/supabase");
const { paymentApi } = require("../_lib/mp");

module.exports = async (req, res) => {
  res.sendStatus(200);

  try {
    const xSignature = req.headers["x-signature"]  || "";
    const xRequestId = req.headers["x-request-id"] || "";
    const dataId     = req.query["data.id"] || req.body?.data?.id;

    if (process.env.MP_WEBHOOK_SECRET && xSignature && dataId) {
      const parts = Object.fromEntries(xSignature.split(",").map((p) => p.trim().split("=")));
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${parts.ts || ""};`;
      const hash = crypto.createHmac("sha256", process.env.MP_WEBHOOK_SECRET).update(manifest).digest("hex");
      if (hash !== parts.v1) {
        console.error("Webhook MP: firma inválida — descartado");
        return;
      }
    }

    const { type, data } = req.body || {};
    if (type !== "payment" || !data?.id) return;

    const payment = await paymentApi.get({ id: String(data.id) });
    const { status, transaction_amount, external_reference } = payment;

    if (!external_reference) return;

    if (external_reference.startsWith("legacy:")) {
      const [, userId, planSlug] = external_reference.split(":");
      if (status === "approved") {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        const { error } = await supabase.from("profiles").update({
          subscription_status: "active",
          auth_status: "active",
          subscription_end_date: endDate.toISOString(),
        }).eq("id", userId);
        if (error) console.error("Webhook legacy error:", error.message);
        else console.log(`Webhook legacy: perfil ${userId} activado 30 días (plan ${planSlug})`);
      }
      return;
    }

    const pagoId = parseInt(external_reference.replace("pago_", ""), 10);
    if (!pagoId || isNaN(pagoId)) return;

    const { data: pagoRow } = await supabase.from("pagos").select("mp_preference_id").eq("id", pagoId).single();

    const { error } = await supabase.rpc("procesar_pago_mp", {
      p_mp_payment_id:  String(data.id),
      p_mp_status:      status,
      p_monto_recibido: Math.round(transaction_amount),
      p_preference_id:  pagoRow?.mp_preference_id || null,
    });

    if (error) console.error(`Webhook MP: procesar_pago_mp falló:`, error.message);
    else console.log(`Webhook MP: pago ${data.id} procesado OK (estado: ${status})`);
  } catch (err) {
    console.error("Webhook MP: error inesperado:", err.message);
  }
};
