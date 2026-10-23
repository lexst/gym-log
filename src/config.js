// Supabase project for sync. The publishable key is public by design; access is
// limited by row-level security (see supabase/schema.sql).
// Build-time env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) override these defaults.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://uetnrdxlymxfifjphchj.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_yzSEhhu989w8fYqx6ndUNA__6SOqFJ2';
