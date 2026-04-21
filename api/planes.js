module.exports = async (req, res) => {
  try {
    const { createClient } = require("@supabase/supabase-js");
    const { handleCors } = require("./_lib/cors");
    if (handleCors(req, res)) return;
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const [{ data: uf, error: ufErr }, { data: planes, error: plErr }] = await Promise.all([
      supabase.rpc("get_uf_actual"),
      supabase.from("planes").select("*").eq("activo", true).order("precio_uf"),
    ]);
    if (ufErr) throw ufErr;
    if (plErr) throw plErr;
    res.json({ planes: planes.map(p => ({ ...p, precio_clp: Math.round(p.uf_cantidad * uf), uf_valor: uf })), uf });
  } catch (err) {
    res.status(500).json({ error: err.message || "No se pudo obtener los planes" });
  }
};
