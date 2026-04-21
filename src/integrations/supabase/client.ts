import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://miuirpcrkfnfngvplhqp.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pdWlycGNya2ZuZm5ndnBsaHFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk5NTczNDUsImV4cCI6MjA0NTUzMzM0NX0.2hNfyxK_XTP3Fo9-cip0J742bUVSK452j-L78njRE0Q";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
