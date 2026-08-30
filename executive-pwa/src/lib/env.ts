export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  tenantId: import.meta.env.VITE_TENANT_ID as string,
};

if (!env.supabaseUrl || !env.supabaseAnonKey || !env.tenantId) {
  // Fails loudly at startup rather than producing confusing downstream
  // Supabase errors — this app has no offline/local fallback (DL-002), so
  // there is no reasonable degraded mode if these are missing.
  // eslint-disable-next-line no-console
  console.error('[env] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_TENANT_ID — check executive-pwa/.env');
}
