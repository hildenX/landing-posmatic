module.exports = (req, res) => {
  res.json({ ok: true, node: process.version, env_supabase: !!process.env.SUPABASE_URL });
};
