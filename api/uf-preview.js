const supabase = require("./_lib/supabase");
const { handleCors } = require("./_lib/cors");
const { fetchUFDirecto } = require("./_lib/helpers");

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
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
};
