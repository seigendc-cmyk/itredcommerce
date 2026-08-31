import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Browser client using the ANON key only — this app never holds the
// service-role key (that stays server-side, in the rider-signin/
// rider-roster Edge Functions). Every read/write this client makes is
// subject to RLS via the JWT claims the Custom Access Token Hook injects
// (tenant_id/branch_id/staff_role/staff_id) — see DL-011/DL-013, and
// supabase/migrations/20260831140000_rider_pwa.sql for the rider-specific
// policies this app relies on.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'itred-rider-auth',
  },
});
