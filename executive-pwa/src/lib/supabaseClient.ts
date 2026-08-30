import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Browser client using the ANON key only — this app never holds the
// service-role key (that stays server-side, in the Express backend and the
// executive-signin/executive-roster Edge Functions). Every read this client
// makes is subject to RLS via the JWT claims the Custom Access Token Hook
// injects (tenant_id/branch_id/staff_role/staff_id) — see DL-011/DL-013.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'itred-executive-auth',
  },
});
