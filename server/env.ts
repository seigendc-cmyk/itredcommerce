import 'dotenv/config';
import path from 'node:path';

export const env = {
  apiPort: Number(process.env.API_PORT) || 4000,
  dbPath: path.resolve(process.cwd(), process.env.DB_PATH || './data/itred.db'),
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me',
  isProduction: process.env.NODE_ENV === 'production',
  // DL-005 (Prompt 5): server-side-only Supabase access. SUPABASE_SERVICE_ROLE_KEY
  // bypasses RLS and must never be sent to any client or logged — it's read
  // here specifically because this is a trusted backend process, not a browser.
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  // The tenant this local install is bound to. Every Supabase call this
  // server makes (staff pull, PIN verification) is scoped to this tenant —
  // see ITRED_GOVERNANCE_AND_ARCHITECTURE.md DL-011.
  tenantId: process.env.TENANT_ID || '',
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey && env.tenantId);
