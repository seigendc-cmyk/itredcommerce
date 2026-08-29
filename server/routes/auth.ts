import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';

const router = Router();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;
const failedAttempts = new Map<string, { count: number; lockedUntil?: number }>();

function rowToPublicStaff(row: any) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    role: row.role,
    roleTitle: row.role_title,
    department: row.department,
    avatarInitials: row.avatar_initials,
    lastLogin: row.last_login,
    permissions: JSON.parse(row.permissions || '[]'),
    terminalAccess: JSON.parse(row.terminal_access || '[]'),
  };
}

router.get(
  '/staff',
  asyncHandler(async (_req, res) => {
    // Public roster for the PIN-entry screen — never includes pin_hash.
    const rows = db
      .prepare('SELECT * FROM staff WHERE is_active = 1 ORDER BY name ASC')
      .all() as any[];
    res.json(rows.map(rowToPublicStaff));
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { staffId, pin } = req.body as { staffId?: string; pin?: string };
    if (!staffId || !pin) {
      throw new ApiError(400, 'staffId and pin are required');
    }

    const lockKey = staffId;
    const attempt = failedAttempts.get(lockKey);
    if (attempt?.lockedUntil && attempt.lockedUntil > Date.now()) {
      throw new ApiError(429, 'Too many failed attempts. Try again shortly.', 'LOCKED_OUT');
    }

    const row = db.prepare('SELECT * FROM staff WHERE id = ? AND is_active = 1').get(staffId) as any;
    const valid = row ? await bcrypt.compare(pin, row.pin_hash) : false;

    if (!row || !valid) {
      const next = { count: (attempt?.count || 0) + 1, lockedUntil: undefined as number | undefined };
      if (next.count >= MAX_ATTEMPTS) next.lockedUntil = Date.now() + LOCKOUT_MS;
      failedAttempts.set(lockKey, next);
      throw new ApiError(401, 'Invalid staff PIN', 'INVALID_CREDENTIALS');
    }

    failedAttempts.delete(lockKey);
    req.session.staffId = row.id;
    req.session.staffCode = row.code;
    req.session.loginAt = Date.now();

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    db.prepare('UPDATE staff SET last_login = ? WHERE id = ?').run(nowStr, row.id);

    res.json({ staff: rowToPublicStaff({ ...row, last_login: nowStr }) });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    req.session.destroy(() => {});
    res.status(204).send();
  })
);

router.get(
  '/session',
  asyncHandler(async (req, res) => {
    if (!req.session.staffId) {
      res.json({ authenticated: false });
      return;
    }
    const row = db
      .prepare('SELECT * FROM staff WHERE id = ? AND is_active = 1')
      .get(req.session.staffId) as any;
    if (!row) {
      res.json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, staff: rowToPublicStaff(row) });
  })
);

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json(req.currentStaff);
}));

export default router;
