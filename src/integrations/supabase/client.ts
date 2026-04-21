import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://miuirpcrkfnfngvplhqp.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_i4Gr8f8Pc-0XyCsRt60kFA_3b8K2v5r";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
