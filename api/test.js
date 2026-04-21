module.exports = async (req, res) => {
  try {
    const { createClient } = require("@supabase/supabase-js");
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supa.from("profiles").select("id").limit(1);
    res.json({ ok: true, node: process.version, error: error?.message || null, count: data?.length });
  } catch (err) {
    res.json({ ok: false, crash: err.message });
  }
};
