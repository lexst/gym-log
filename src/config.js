// Supabase project for sync. The anon key is public by design; access is
// limited by row-level security (see supabase/schema.sql).
// Leave empty to run the app without sync.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
