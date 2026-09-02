import { db } from '../db/connection';
import { env } from '../env';

// Reads/writes local SQLite's installation_config singleton (id = 1),
// scaffolded by 002_multi_tenant.sql specifically for this: "this device's
// fixed tenant/branch/terminal binding, captured once at activation time."
// That migration deliberately didn't wire any application code to it —
// the Business Profile onboarding wizard is the prompt that does.

export interface InstallationConfigRow {
  installationId: string | null;
  tenantId: string | null;
  branchId: string | null;
  terminalId: string | null;
  appSurface: 'BRANCH_TERMINAL' | 'HEAD_OFFICE';
  activationCode: string | null;
  activatedAt: string | null;
}

export function getInstallationConfig(): InstallationConfigRow | null {
  const row = db.prepare('SELECT * FROM installation_config WHERE id = 1').get() as any;
  if (!row) return null;
  return {
    installationId: row.installation_id,
    tenantId: row.tenant_id,
    branchId: row.branch_id,
    terminalId: row.terminal_id,
    appSurface: row.app_surface,
    activationCode: row.activation_code,
    activatedAt: row.activated_at,
  };
}

// Called once at server boot, after migrations, before deciding whether
// background sync can start. A fresh install has no TENANT_ID env var; if
// onboarding already completed in a prior process run, the tenant this
// install is bound to lives here instead.
export function bootstrapTenantIdFromLocal(): void {
  if (env.tenantId) return;
  const config = getInstallationConfig();
  if (config?.tenantId) {
    env.tenantId = config.tenantId;
    console.log(`[installationConfig] restored tenant binding from local install config: ${config.tenantId}`);
  }
}

export function persistInstallationConfig(config: {
  installationId: string;
  tenantId: string;
  branchId: string;
  terminalId: string;
  appSurface: 'BRANCH_TERMINAL' | 'HEAD_OFFICE';
  activationCode: string | null;
}): void {
  db.prepare(`
    INSERT INTO installation_config (id, installation_id, tenant_id, branch_id, terminal_id, app_surface, activation_code, activated_at)
    VALUES (1, @installation_id, @tenant_id, @branch_id, @terminal_id, @app_surface, @activation_code, @activated_at)
    ON CONFLICT(id) DO UPDATE SET
      installation_id = excluded.installation_id,
      tenant_id = excluded.tenant_id,
      branch_id = excluded.branch_id,
      terminal_id = excluded.terminal_id,
      app_surface = excluded.app_surface,
      activation_code = excluded.activation_code,
      activated_at = excluded.activated_at
  `).run({
    installation_id: config.installationId,
    tenant_id: config.tenantId,
    branch_id: config.branchId,
    terminal_id: config.terminalId,
    app_surface: config.appSurface,
    activation_code: config.activationCode,
    activated_at: new Date().toISOString(),
  });

  // Make the newly-provisioned tenant visible to the rest of this process
  // immediately — every route scoped by env.tenantId (and isSupabaseConfigured())
  // must see it without a restart. See server/env.ts's comment on why
  // env.tenantId is mutable.
  env.tenantId = config.tenantId;
}
