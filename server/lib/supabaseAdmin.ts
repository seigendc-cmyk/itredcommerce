import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from '../env';

// Service-role client — bypasses RLS entirely. This module must NEVER be
// imported by anything that could reach a browser bundle; it exists only for
// this trusted Express backend (DL-005 / Prompt 5's "Tauri apps talk to
// Supabase through their own trusted backend" design — see
// ITRED_GOVERNANCE_AND_ARCHITECTURE.md DL-011).
//
// Lazily constructed and nullable rather than throwing at import time: a
// local dev environment with no Supabase credentials configured must still
// be able to boot and run entirely offline (local SQLite + last-synced
// staff cache) — every caller here is expected to check isSupabaseConfigured
// (or handle a null client) and fall back accordingly.
let client: SupabaseClient | null = null;

function getOrCreateClient(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return getOrCreateClient();
}

// Onboarding-only escape hatch: every other caller in this codebase is
// deliberately scoped to env.tenantId via isSupabaseConfigured() (getSupabaseAdmin
// above), because every other route already belongs to a provisioned
// tenant. Onboarding is the one legitimate exception — it's the thing that
// *creates* env.tenantId in the first place, so it can't wait for it. Gated
// on url+key only; never import this outside server/routes/onboarding.ts.
export function getSupabaseAdminUnscoped(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null;
  return getOrCreateClient();
}
