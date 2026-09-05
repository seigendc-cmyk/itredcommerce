export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
};

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  // Fails loudly at startup rather than producing confusing downstream
  // Supabase errors — this app has no offline/local fallback (DL-038).
  // eslint-disable-next-line no-console
  console.error('[env] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — check apps/console/.env');
}
