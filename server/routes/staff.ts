import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { generateId } from '../lib/ids';
import { applyWithOutbox } from '../sync/outboxWriter';

const router = Router();
router.use(requireAuth);
// Distinct from the public, ungated, active-only /auth/staff roster used by
// the PIN-entry screen — this is the authenticated management CRUD surface,
// head-office only. Never returns pin_hash.
router.use(requireAccessRole(...BACK_OFFICE_WRITE_ROLES));

function rowToStaff(row: any) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    role: row.role,
    roleTitle: row.role_title,
    department: row.department,
    accessRole: row.access_role,
    avatarInitials: row.avatar_initials,
    lastLogin: row.last_login,
    permissions: JSON.parse(row.permissions || '[]'),
    terminalAccess: JSON.parse(row.terminal_access || '[]'),
    isActive: !!row.is_active,
  };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT * FROM staff ORDER BY name ASC').all() as any[];
    res.json(rows.map(rowToStaff));
  })
);

interface CreateBody {
  code: string;
  name: string;
  role: string;
  roleTitle: string;
  department?: string;
  accessRole: string;
  pin: string;
  avatarInitials?: string;
  permissions?: string[];
  terminalAccess?: string[];
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body as CreateBody;
    if (!body?.code || !body.name || !body.role || !body.accessRole || !body.pin) {
      throw new ApiError(400, 'code, name, role, accessRole and pin are required');
    }
    if (!/^\d{4,6}$/.test(body.pin)) {
      throw new ApiError(400, 'pin must be 4-6 digits');
    }

    const id = generateId('STF');
    const pinHash = bcrypt.hashSync(body.pin, 10);

    try {
      applyWithOutbox({
        db,
        tenantId: null,
        table: 'staff',
        pkColumn: 'id',
        pk: id,
        operation: 'INSERT',
        payload: { id, code: body.code, name: body.name, role: body.role, accessRole: body.accessRole },
        apply: () => {
          db.prepare(
            `INSERT INTO staff (id, code, name, role, role_title, department, access_role, pin_hash, avatar_initials, permissions, terminal_access, is_active)
             VALUES (@id, @code, @name, @role, @roleTitle, @department, @accessRole, @pinHash, @avatarInitials, @permissions, @terminalAccess, 1)`
          ).run({
            id,
            code: body.code,
            name: body.name,
            role: body.role,
            roleTitle: body.roleTitle ?? body.role,
            department: body.department ?? null,
            accessRole: body.accessRole,
            pinHash,
            avatarInitials: body.avatarInitials ?? body.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
            permissions: JSON.stringify(body.permissions ?? []),
            terminalAccess: JSON.stringify(body.terminalAccess ?? []),
          });
        },
      });
    } catch (err: any) {
      if (typeof err?.message === 'string' && err.message.includes('UNIQUE') && err.message.includes('staff.code')) {
        throw new ApiError(409, `Staff code ${body.code} is already in use`, 'STAFF_CODE_TAKEN');
      }
      throw err;
    }

    const row = db.prepare('SELECT * FROM staff WHERE id = ?').get(id);
    res.status(201).json(rowToStaff(row));
  })
);

interface UpdateBody {
  name?: string;
  roleTitle?: string;
  department?: string;
  accessRole?: string;
  permissions?: string[];
  terminalAccess?: string[];
  isActive?: boolean;
}

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id) as any;
    if (!existing) throw new ApiError(404, 'Staff member not found');
    const body = req.body as UpdateBody;

    applyWithOutbox({
      db,
      tenantId: null,
      table: 'staff',
      pkColumn: 'id',
      pk: existing.id,
      operation: 'UPDATE',
      payload: { id: existing.id, ...body },
      apply: () => {
        db.prepare(
          `UPDATE staff SET name = ?, role_title = ?, department = ?, access_role = ?, permissions = ?, terminal_access = ?, is_active = ? WHERE id = ?`
        ).run(
          body.name ?? existing.name,
          body.roleTitle ?? existing.role_title,
          body.department ?? existing.department,
          body.accessRole ?? existing.access_role,
          body.permissions ? JSON.stringify(body.permissions) : existing.permissions,
          body.terminalAccess ? JSON.stringify(body.terminalAccess) : existing.terminal_access,
          body.isActive === undefined ? existing.is_active : body.isActive ? 1 : 0,
          existing.id
        );
      },
    });

    const row = db.prepare('SELECT * FROM staff WHERE id = ?').get(existing.id);
    res.json(rowToStaff(row));
  })
);

router.post(
  '/:id/reset-pin',
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id) as any;
    if (!existing) throw new ApiError(404, 'Staff member not found');
    const { pin } = req.body as { pin?: string };
    if (!pin || !/^\d{4,6}$/.test(pin)) throw new ApiError(400, 'pin must be 4-6 digits');

    const pinHash = bcrypt.hashSync(pin, 10);
    applyWithOutbox({
      db,
      tenantId: null,
      table: 'staff',
      pkColumn: 'id',
      pk: existing.id,
      operation: 'UPDATE',
      payload: { id: existing.id, pinReset: true },
      apply: () => {
        db.prepare('UPDATE staff SET pin_hash = ? WHERE id = ?').run(pinHash, existing.id);
      },
    });

    res.status(204).send();
  })
);

router.post(
  '/:id/deactivate',
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id) as any;
    if (!existing) throw new ApiError(404, 'Staff member not found');
    applyWithOutbox({
      db, tenantId: null, table: 'staff', pkColumn: 'id', pk: existing.id, operation: 'UPDATE',
      payload: { id: existing.id, isActive: false },
      apply: () => db.prepare('UPDATE staff SET is_active = 0 WHERE id = ?').run(existing.id),
    });
    const row = db.prepare('SELECT * FROM staff WHERE id = ?').get(existing.id);
    res.json(rowToStaff(row));
  })
);

router.post(
  '/:id/reactivate',
  asyncHandler(async (req, res) => {
    const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id) as any;
    if (!existing) throw new ApiError(404, 'Staff member not found');
    applyWithOutbox({
      db, tenantId: null, table: 'staff', pkColumn: 'id', pk: existing.id, operation: 'UPDATE',
      payload: { id: existing.id, isActive: true },
      apply: () => db.prepare('UPDATE staff SET is_active = 1 WHERE id = ?').run(existing.id),
    });
    const row = db.prepare('SELECT * FROM staff WHERE id = ?').get(existing.id);
    res.json(rowToStaff(row));
  })
);

export default router;
