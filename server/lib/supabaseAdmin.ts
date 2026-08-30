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

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
