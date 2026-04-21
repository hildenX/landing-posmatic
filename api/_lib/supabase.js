const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  (process.env.SUPABASE_URL || "").trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
);

module.exports = supabase;
