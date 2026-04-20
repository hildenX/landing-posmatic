const supabase = require("./_lib/supabase");
const { handleCors } = require("./_lib/cors");

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
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
};
