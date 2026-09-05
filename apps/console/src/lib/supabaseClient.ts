import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Browser client using the ANON key only — this app never holds the
// service-role key (see .env.example). Note this client currently has no
// working read/write path to any of the six console-owned tables
// (license_keys, terminal_activation_tokens, activation_requests,
// plan_components, tenant_subscriptions, billing_invoices): those tables
// grant zero RLS policies to `anon`/`authenticated` by design (see the
// console schema migration's header comment) until a console-operator auth
// mechanism exists. This client is scaffolded now for whatever that
// mechanism turns out to be (Prompt 14+) — not used by any page yet.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'itred-console-auth',
  },
});
