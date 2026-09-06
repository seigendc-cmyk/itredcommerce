import { db } from '../db/connection';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getInstallationConfig } from '../lib/installationConfig';
import { verifyTerminalActivationToken, type TerminalTokenStatus } from '../lib/terminalActivationToken';
import { recordTerminalActivationConfirmation } from '../lib/terminalActivationConfirmations';
import { nowIso } from '../lib/ids';

export interface RemoteTerminalTokenRow {
  signature: string;
  tenant_id: string;
  terminal_id: string;
  issued_at: string;
}

export type TerminalTokenSyncAction = 'REPLACE' | 'SKIP_STALE' | 'SKIP_INVALID' | 'SKIP_NO_REMOTE_TOKEN';

export interface TerminalTokenSyncDecision {
  action: TerminalTokenSyncAction;
  reason?: TerminalTokenStatus;
}

/**
 * Pure decision logic for whether a pulled-down TerminalActivationToken row
 * should replace what's currently cached locally — split out from the
 * Supabase/SQLite I/O below for the same reason server/sync/
 * conflictResolution.ts and backoff.ts are split from drainLoop.ts:
 * independently testable without a live database or network. A remote row
 * only ever wins when it's both genuinely newer (by issued_at) and passes
 * signature + identity verification — this is a cache refresh, not an
 * authority, and must never let a stale or corrupted/misdirected row
 * overwrite a good local cache.
 */
export function decideTerminalTokenSync(
  remote: RemoteTerminalTokenRow | null,
  existingIssuedAt: string | null,
  expected: { tenantId: string; terminalId: string },
  now: Date = new Date(),
  // Forwarded to verifyTerminalActivationToken — see that function's own
  // comment. Lets tests exercise a genuine REPLACE outcome against a
  // locally generated keypair, without the real private key.
  publicKeys?: Readonly<Record<string, string>>
): TerminalTokenSyncDecision {
  if (!remote) return { action: 'SKIP_NO_REMOTE_TOKEN' };

  if (existingIssuedAt && new Date(remote.issued_at).getTime() <= new Date(existingIssuedAt).getTime()) {
    return { action: 'SKIP_STALE' };
  }

  const verification = verifyTerminalActivationToken(remote.signature, expected, now, undefined, publicKeys);
  if (verification.status === 'invalid-signature' || verification.status === 'identity-mismatch') {
    return { action: 'SKIP_INVALID', reason: verification.status };
  }

  return { action: 'REPLACE' };
}

// Pull-only counterpart to the outbox drain loop, same shape as
// staffPull.ts/tenantPull.ts (DL-048) — reads the raw terminal_activation_tokens
// table directly via the service-role admin client, NOT the tenant-facing
// v_tenant_terminal_activation_tokens view from Prompt 13. That view
// deliberately excludes `signature` (any staff session at the tenant can
// read it, and a leaked signature is a bearer credential — see the schema
// migration's own column comment), which is exactly the field this pull
// needs to cache a usable token locally. getSupabaseAdmin() already bypasses
// RLS entirely for this trusted, server-side-only process (identical trust
// model to pullStaffFromSupabase/pullTenantFromSupabase, both of which also
// read their raw tables directly) — the view's exclusion protects a
// browser-facing authenticated role, which this pull never is.
export async function pullTerminalActivationTokenFromSupabase(): Promise<{ pulled: boolean } | null> {
  const installation = getInstallationConfig();
  if (!installation?.tenantId || !installation.terminalId) return null;

  const client = getSupabaseAdmin();
  if (!client) return null;

  const { data, error } = await client
    .from('terminal_activation_tokens')
    .select('signature, tenant_id, terminal_id, issued_at')
    .eq('tenant_id', installation.tenantId)
    .eq('terminal_id', installation.terminalId)
    .eq('status', 'active')
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[terminalActivationTokenPull] failed to pull token from Supabase:', error);
    return null;
  }

  const existing = db.prepare('SELECT issued_at FROM terminal_activation_state WHERE id = 1').get() as
    | { issued_at: string }
    | undefined;

  const decision = decideTerminalTokenSync(
    data ?? null,
    existing?.issued_at ?? null,
    { tenantId: installation.tenantId, terminalId: installation.terminalId }
  );

  if (decision.action === 'SKIP_INVALID') {
    console.error('[terminalActivationTokenPull] pulled token failed verification:', decision.reason);
    return null;
  }
  if (decision.action !== 'REPLACE') {
    return { pulled: false };
  }

  const verification = verifyTerminalActivationToken(data!.signature, {
    tenantId: installation.tenantId,
    terminalId: installation.terminalId,
  });
  const payload = verification.payload!;

  const activatedAt = nowIso();
  db.prepare(
    `INSERT INTO terminal_activation_state (id, token, tenant_id, terminal_id, plan_tier, issued_at, expires_at, activated_at)
     VALUES (1, @token, @tenantId, @terminalId, @planTier, @issuedAt, @expiresAt, @activatedAt)
     ON CONFLICT(id) DO UPDATE SET
       token = excluded.token,
       tenant_id = excluded.tenant_id,
       terminal_id = excluded.terminal_id,
       plan_tier = excluded.plan_tier,
       issued_at = excluded.issued_at,
       expires_at = excluded.expires_at,
       activated_at = excluded.activated_at`
  ).run({
    token: data!.signature,
    tenantId: payload.tenantId,
    terminalId: payload.terminalId,
    planTier: payload.planTier,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    activatedAt,
  });

  // DL-057: this replace *is* the "received and activated" event for the
  // sync-down path — log it for two-ledger reconciliation against the
  // console's own terminal_activation_tokens issuance record.
  recordTerminalActivationConfirmation({
    tenantId: payload.tenantId,
    terminalId: payload.terminalId,
    tokenIssuedAt: payload.issuedAt,
    eventType: 'sync_down',
    confirmedAt: activatedAt,
  });

  console.log('[terminalActivationTokenPull] synced a newer TerminalActivationToken');
  return { pulled: true };
}
