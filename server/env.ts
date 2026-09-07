import 'dotenv/config';
import path from 'node:path';

export const env = {
  apiPort: Number(process.env.API_PORT) || 4000,
  dbPath: path.resolve(process.cwd(), process.env.DB_PATH || './data/itred.db'),
  distDir: path.resolve(process.cwd(), process.env.DIST_DIR || 'dist'),
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me',
  isProduction: process.env.NODE_ENV === 'production',
  // DL-005 (Prompt 5): server-side-only Supabase access. SUPABASE_SERVICE_ROLE_KEY
  // bypasses RLS and must never be sent to any client or logged — it's read
  // here specifically because this is a trusted backend process, not a browser.
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  // The tenant this local install is bound to. Every Supabase call this
  // server makes (staff pull, PIN verification) is scoped to this tenant —
  // see ITRED_GOVERNANCE_AND_ARCHITECTURE.md DL-011. Mutable (not the const
  // it looks like from the outside — `env` itself is const, its properties
  // aren't): on a fresh install there is no TENANT_ID yet, and the Business
  // Profile onboarding wizard's completion is what sets this, in-process,
  // via server/lib/installationConfig.ts's persistInstallationConfig() —
  // without that, every route already scoped by env.tenantId would need a
  // full process restart before it could see a newly-onboarded tenant.
  tenantId: process.env.TENANT_ID || '',
  // Prompt 16 / DL-075: shared secret this backend sends (as
  // x-zimra-service-secret) when it triggers the centralized
  // zimra-fiscal-service Edge Function on a staff-initiated
  // register/syncConfig/renewCertificate action. Must match that Edge
  // Function's own ZIMRA_SERVICE_SECRET secret exactly — a manual,
  // out-of-band deployment step, the same class of gap as
  // FISCAL_CREDENTIALS_KEY's distribution. NOT the same value as
  // ZIMRA_CREDENTIALS_KEY (which this backend never holds at all).
  zimraServiceSecret: process.env.ZIMRA_SERVICE_SECRET || '',
};

// A function, not a boolean, for the same reason env.tenantId is mutable —
// it must reflect a tenant that gets provisioned mid-process by onboarding,
// not only what was true at boot.
export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey && env.tenantId);
}
