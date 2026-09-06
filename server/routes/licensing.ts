import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { nowIso } from '../lib/ids';
import { getInstallationConfig } from '../lib/installationConfig';
import { verifyTerminalActivationToken } from '../lib/terminalActivationToken';
import { recordTerminalActivationConfirmation } from '../lib/terminalActivationConfirmations';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';

// DL-039/DL-040/DL-046/DL-048: accepts a TerminalActivationToken relayed
// manually (via WhatsApp, per DL-041) from a console operator, verifies it
// entirely offline against this install's own tenant/terminal binding, and
// reports the resulting module-lock state. Enforcement of that lock across
// every Sales/Purchasing route is wired client-side in
// src/utils/accessRoleGate.ts + src/hooks/useModuleLock.ts (DL-048) — this
// route only issues the primitives: activate, and report status.

const router = Router();
router.use(requireAuth);

function toStatusResponse(row: { token: string; tenant_id: string; terminal_id: string }) {
  const verification = verifyTerminalActivationToken(row.token, {
    tenantId: row.tenant_id,
    terminalId: row.terminal_id,
  });
  return {
    activated: true,
    status: verification.status,
    graceDaysRemaining: verification.graceDaysRemaining,
    payload: verification.payload,
  };
}

router.get(
  '/status',
  // No requireAccessRole here, deliberately (DL-048): every session at this
  // terminal — including a TILL_OPERATOR, who is exactly who a Sales lock
  // actually affects — must be able to read its own terminal's lock status.
  // Nothing this route returns is tenant-cross-cutting or role-sensitive;
  // it's this one terminal's own already-locally-cached state.
  asyncHandler(async (_req, res) => {
    const row = db.prepare('SELECT * FROM terminal_activation_state WHERE id = 1').get() as
      | { token: string; tenant_id: string; terminal_id: string }
      | undefined;
    if (!row) {
      res.json({ activated: false });
      return;
    }
    res.json(toStatusResponse(row));
  })
);

interface ActivateBody {
  token?: string;
}

router.post(
  '/activate-terminal',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (req, res) => {
    const body = req.body as ActivateBody;
    if (!body?.token?.trim()) throw new ApiError(400, 'token is required');

    const installation = getInstallationConfig();
    if (!installation?.tenantId || !installation.terminalId) {
      throw new ApiError(409, 'This install has not completed onboarding yet — no tenant/terminal binding to activate against', 'NOT_ONBOARDED');
    }

    const token = body.token.trim();
    const verification = verifyTerminalActivationToken(token, {
      tenantId: installation.tenantId,
      terminalId: installation.terminalId,
    });
    // Compared against the literal status strings, not a truthy/falsy
    // check — this project's tsconfig doesn't enable strictNullChecks,
    // under which only a direct literal comparison reliably narrows a
    // discriminated union in this TS version.
    if (verification.status !== 'valid') {
      const messages: Record<string, string> = {
        'invalid-signature': 'This token is malformed or was not signed by a recognized key',
        'identity-mismatch': 'This token was not issued to this tenant/terminal',
        'expired-in-grace': 'This token has already expired — request a new one',
        'expired-locked': 'This token has already expired — request a new one',
      };
      throw new ApiError(400, messages[verification.status] ?? 'Invalid token', verification.status.toUpperCase().replace(/-/g, '_'));
    }

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
      token,
      tenantId: payload.tenantId,
      terminalId: payload.terminalId,
      planTier: payload.planTier,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      activatedAt,
    });

    // DL-057: this manual paste-in *is* the "received and activated" event
    // for this path — log it for two-ledger reconciliation against the
    // console's own terminal_activation_tokens issuance record.
    recordTerminalActivationConfirmation({
      tenantId: payload.tenantId,
      terminalId: payload.terminalId,
      tokenIssuedAt: payload.issuedAt,
      eventType: 'manual_paste',
      confirmedAt: activatedAt,
    });

    res.status(201).json({
      activated: true,
      status: verification.status,
      graceDaysRemaining: verification.graceDaysRemaining,
      payload,
    });
  })
);

// DL-041/DL-056: logs the outbound WhatsApp "Request Activation Code"
// action as an activation_requests row so it shows up in the console's
// ActivationRequestsPage queue (apps/console, built ahead of plan in
// bc264b6). Written directly and synchronously via the service-role admin
// client — same as delivery_orders (DL-015) — rather than queued through
// the local outbox: opening a wa.me link inherently requires connectivity,
// so there is no offline case to make durable here. Best-effort: a failed
// write is reported to the caller but never blocks the WhatsApp link itself
// from opening, since getting the tenant into a WhatsApp conversation with
// support matters more than the console's audit-trail row succeeding on
// the first try.
router.post(
  '/request-activation',
  requireAccessRole(...BACK_OFFICE_WRITE_ROLES),
  asyncHandler(async (_req, res) => {
    const installation = getInstallationConfig();
    if (!installation?.tenantId) {
      throw new ApiError(409, 'This install has not completed onboarding yet — no tenant to request activation for', 'NOT_ONBOARDED');
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new ApiError(502, 'Not connected to the licensing backend — try again once online');
    }

    const requestedAt = nowIso();
    const { data, error } = await supabase
      .from('activation_requests')
      .insert({
        tenant_id: installation.tenantId,
        terminal_id: installation.terminalId,
        requested_at: requestedAt,
        channel: 'whatsapp',
        fulfillment_status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[licensing] failed to log activation request:', error);
      throw new ApiError(502, 'Could not log the activation request — try again once online');
    }

    res.status(201).json({ id: data!.id as string, requestedAt });
  })
);

export default router;
