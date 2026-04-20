const { createClient } = require("@supabase/supabase-js");

let _supa = null;

function getSupabase() {
  if (!_supa) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    }
    _supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _supa;
}

module.exports = new Proxy({}, {
  get: (_, prop) => getSupabase()[prop],
});
