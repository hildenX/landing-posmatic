const supabase = require("./_lib/supabase");
const { handleCors } = require("./_lib/cors");

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
  try {
    const { data, error } = await supabase.rpc("get_uf_actual");
    if (error) throw error;
    res.json({ uf: data });
  } catch (err) {
    console.error("Error obteniendo UF:", err.message);
    res.status(500).json({ error: "No se pudo obtener el valor de la UF" });
  }
};
