import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { verifyPinAgainstSupabase, type VerifiedStaff } from '../lib/staffAuth';
import { env } from '../env';

const router = Router();

// Local circuit breaker — only consulted when Supabase itself couldn't be
// reached (see verifyPinAgainstSupabase's UNREACHABLE outcome). Real,
// centrally-enforced lockout now lives in Postgres (failed_attempts/
// locked_until on staff, checked inside verify_staff_pin) precisely because
// an in-process Map like this one doesn't stop an attacker from spreading
// guesses across desks, and resets on every restart — DL-011.
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
    // Normalizes whichever casing the source row uses — local SQLite is
    // already UPPER_SNAKE_CASE (no-op), Supabase's app_staff_role enum is
    // lowercase (see DL-009/DL-011).
    accessRole: typeof row.access_role === 'string' ? row.access_role.toUpperCase() : row.access_role,
    avatarInitials: row.avatar_initials,
    lastLogin: row.last_login,
    permissions: JSON.parse(row.permissions || '[]'),
    terminalAccess: JSON.parse(row.terminal_access || '[]'),
  };
}

function verifiedStaffToPublic(staff: VerifiedStaff) {
  return {
    id: staff.id,
    code: staff.code,
    name: staff.name,
    role: staff.role,
    roleTitle: staff.roleTitle,
    department: staff.department,
    accessRole: staff.accessRole,
    avatarInitials: staff.avatarInitials,
    lastLogin: staff.lastLogin,
    permissions: staff.permissions,
    terminalAccess: staff.terminalAccess,
  };
}

router.get(
  '/staff',
  asyncHandler(async (_req, res) => {
    // Public roster for the PIN-entry screen — never includes pin_hash.
    // Prefers Supabase (freshest roster); falls back to the last-synced
    // local cache when Supabase is unconfigured or unreachable (DL-005).
    const client = getSupabaseAdmin();
    if (client) {
      try {
        const { data, error } = await client
          .from('staff')
          .select('id, code, name, role, role_title, department, access_role, avatar_initials, permissions, terminal_access, last_login')
          .eq('tenant_id', env.tenantId)
          .eq('is_active', true)
          .order('name', { ascending: true });
        if (!error && data) {
          res.json(data.map(rowToPublicStaff));
          return;
        }
        console.error('[auth] GET /staff Supabase query failed, falling back to local cache:', error);
      } catch (err) {
        console.error('[auth] GET /staff Supabase call failed, falling back to local cache:', err);
      }
    }

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

    const supaResult = await verifyPinAgainstSupabase(staffId, pin);

    if (supaResult.outcome === 'LOCKED_OUT') {
      throw new ApiError(429, 'Too many failed attempts. Try again shortly.', 'LOCKED_OUT');
    }
    if (supaResult.outcome === 'INVALID') {
      throw new ApiError(401, 'Invalid staff PIN', 'INVALID_CREDENTIALS');
    }
    if (supaResult.outcome === 'SUCCESS') {
      req.session.staffId = supaResult.staff.id;
      req.session.staffCode = supaResult.staff.code;
      req.session.loginAt = Date.now();
      res.json({ staff: verifiedStaffToPublic(supaResult.staff) });
      return;
    }

    // outcome === 'UNREACHABLE' — Supabase couldn't be consulted at all;
    // fall back to bcrypt against the last-synced local cache (DL-005's
    // offline requirement), gated by the local circuit-breaker lockout.
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
