import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { nowIso } from '../lib/ids';
import { getInstallationConfig } from '../lib/installationConfig';
import { verifyTerminalActivationToken } from '../lib/terminalActivationToken';

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

    res.status(201).json({
      activated: true,
      status: verification.status,
      graceDaysRemaining: verification.graceDaysRemaining,
      payload,
    });
  })
);

export default router;
