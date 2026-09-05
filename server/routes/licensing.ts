import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_READ_ROLES, BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { nowIso } from '../lib/ids';
import { getInstallationConfig } from '../lib/installationConfig';
import { verifyTerminalActivationToken, evaluateModuleLock } from '../lib/terminalActivationToken';

// DL-039/DL-040/DL-046: accepts a TerminalActivationToken relayed manually
// (via WhatsApp, per DL-041) from a console operator, verifies it entirely
// offline against this install's own tenant/terminal binding, and reports
// the resulting module-lock state. Enforcement of that lock across every
// Sales/Purchasing route is a follow-up (see the addendum) — this route
// only issues the primitives: activate, and report status.

const router = Router();
router.use(requireAuth);

router.get(
  '/status',
  requireAccessRole(...BACK_OFFICE_READ_ROLES),
  asyncHandler(async (_req, res) => {
    const row = db.prepare('SELECT * FROM terminal_activation_state WHERE id = 1').get() as any;
    if (!row) {
      res.json({ activated: false });
      return;
    }
    const lockState = evaluateModuleLock(
      { tenantId: row.tenant_id, terminalId: row.terminal_id, planTier: row.plan_tier, issuedAt: row.issued_at, expiresAt: row.expires_at },
    );
    res.json({
      activated: true,
      tenantId: row.tenant_id,
      terminalId: row.terminal_id,
      planTier: row.plan_tier,
      issuedAt: row.issued_at,
      activatedAt: row.activated_at,
      ...lockState,
    });
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

    const result = verifyTerminalActivationToken(body.token.trim(), {
      tenantId: installation.tenantId,
      terminalId: installation.terminalId,
    });
    // Compared against the literal `false`, not negated (`!result.valid`) or
    // via an `if/else` — this project's tsconfig doesn't enable
    // strictNullChecks, under which only a direct literal comparison
    // reliably narrows a discriminated union in this TS version.
    if (result.valid === false) {
      throw new ApiError(400, result.reason, 'INVALID_TOKEN');
    }

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
      token: body.token.trim(),
      tenantId: result.payload.tenantId,
      terminalId: result.payload.terminalId,
      planTier: result.payload.planTier,
      issuedAt: result.payload.issuedAt,
      expiresAt: result.payload.expiresAt,
      activatedAt,
    });

    res.status(201).json({
      activated: true,
      planTier: result.payload.planTier,
      issuedAt: result.payload.issuedAt,
      ...evaluateModuleLock(result.payload),
    });
  })
);

export default router;
