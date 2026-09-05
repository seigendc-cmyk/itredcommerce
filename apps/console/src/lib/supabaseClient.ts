import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Browser client using the ANON key only — this app never holds the
// service-role key (see .env.example). A signed-in console operator
// (DL-045) gets RLS-gated read/write to the six console-owned tables
// (license_keys, terminal_activation_tokens, activation_requests,
// plan_components, tenant_subscriptions, billing_invoices) via
// app_is_super_admin(); everyone else still gets zero access, by design.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'itred-console-auth',
  },
});
