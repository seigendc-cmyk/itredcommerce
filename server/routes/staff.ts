import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from '../lib/http';
import { requireAuth, requireAccessRole } from '../middleware/auth';
import { BACK_OFFICE_WRITE_ROLES } from '../lib/accessRoles';
import { generateId } from '../lib/ids';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { assertStrongPin } from '../lib/pinPolicy';
import { env } from '../env';

const router = Router();
router.use(requireAuth);
// Distinct from the public, ungated, active-only /auth/staff roster used by
// the PIN-entry screen — this is the authenticated management CRUD surface,
// head-office only. Never returns pin_hash.
router.use(requireAccessRole(...BACK_OFFICE_WRITE_ROLES));

// DL-011: staff administration under DL-005 writes directly to Supabase
// (the source of truth) when reachable, and is simply unavailable when not
// — unlike the rest of this app's data, staff/PIN changes are NOT queued
// through the local outbox for later push. You shouldn't be able to mint a
// credential offline and have it trusted later without ever having been
// checked against the tenant's real staff record.
function requireSupabase() {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new ApiError(503, 'Staff administration requires a live connection to Supabase', 'SUPABASE_UNAVAILABLE');
  }
  return client;
}

function rowToStaff(row: any) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    role: row.role,
    roleTitle: row.role_title,
    department: row.department,
    accessRole: typeof row.access_role === 'string' ? row.access_role.toUpperCase() : row.access_role,
    avatarInitials: row.avatar_initials,
    lastLogin: row.last_login,
    permissions: row.permissions ?? [],
    terminalAccess: row.terminal_access ?? [],
    isActive: !!row.is_active,
  };
}

function localRowToStaff(row: any) {
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
    const client = getSupabaseAdmin();
    if (client) {
      const { data, error } = await client
        .from('staff')
        .select('id, code, name, role, role_title, department, access_role, avatar_initials, last_login, permissions, terminal_access, is_active')
        .eq('tenant_id', env.tenantId)
        .order('name', { ascending: true });
      if (!error && data) {
        res.json(data.map(rowToStaff));
        return;
      }
      console.error('[staff] GET / Supabase query failed, falling back to local cache (read-only):', error);
    }
    const rows = db.prepare('SELECT * FROM staff ORDER BY name ASC').all() as any[];
    res.json(rows.map(localRowToStaff));
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
    assertStrongPin(body.pin);

    const client = requireSupabase();
    const id = generateId('STF');
    const pinHash = bcrypt.hashSync(body.pin, 12);

    const { data, error } = await client
      .from('staff')
      .insert({
        id,
        tenant_id: env.tenantId,
        code: body.code,
        name: body.name,
        role: body.role,
        role_title: body.roleTitle ?? body.role,
        department: body.department ?? null,
        access_role: body.accessRole.toLowerCase(),
        pin_hash: pinHash,
        avatar_initials: body.avatarInitials ?? body.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase(),
        permissions: body.permissions ?? [],
        terminal_access: body.terminalAccess ?? [],
        is_active: true,
      })
      .select('id, code, name, role, role_title, department, access_role, avatar_initials, last_login, permissions, terminal_access, is_active')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ApiError(409, `Staff code ${body.code} is already in use`, 'STAFF_CODE_TAKEN');
      }
      throw new ApiError(502, 'Failed to create staff member in Supabase', 'SUPABASE_WRITE_FAILED');
    }

    res.status(201).json(rowToStaff(data));
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
    const client = requireSupabase();
    const body = req.body as UpdateBody;

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.roleTitle !== undefined) patch.role_title = body.roleTitle;
    if (body.department !== undefined) patch.department = body.department;
    if (body.accessRole !== undefined) patch.access_role = body.accessRole.toLowerCase();
    if (body.permissions !== undefined) patch.permissions = body.permissions;
    if (body.terminalAccess !== undefined) patch.terminal_access = body.terminalAccess;
    if (body.isActive !== undefined) patch.is_active = body.isActive;

    const { data, error } = await client
      .from('staff')
      .update(patch)
      .eq('tenant_id', env.tenantId)
      .eq('id', req.params.id)
      .select('id, code, name, role, role_title, department, access_role, avatar_initials, last_login, permissions, terminal_access, is_active')
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116') throw new ApiError(404, 'Staff member not found');
      throw new ApiError(502, 'Failed to update staff member in Supabase', 'SUPABASE_WRITE_FAILED');
    }

    res.json(rowToStaff(data));
  })
);

router.post(
  '/:id/reset-pin',
  asyncHandler(async (req, res) => {
    const client = requireSupabase();
    const { pin } = req.body as { pin?: string };
    if (!pin) throw new ApiError(400, 'pin is required');
    assertStrongPin(pin);

    const pinHash = bcrypt.hashSync(pin, 12);
    const { error } = await client
      .from('staff')
      // Also clear any lockout so a PIN reset doesn't leave the account
      // stuck locked out under the credential that was just replaced.
      .update({ pin_hash: pinHash, failed_attempts: 0, locked_until: null })
      .eq('tenant_id', env.tenantId)
      .eq('id', req.params.id);

    if (error) throw new ApiError(502, 'Failed to reset PIN in Supabase', 'SUPABASE_WRITE_FAILED');
    res.status(204).send();
  })
);

async function setActive(tenantId: string, staffId: string, isActive: boolean, client: ReturnType<typeof requireSupabase>) {
  const { data, error } = await client
    .from('staff')
    .update({ is_active: isActive })
    .eq('tenant_id', tenantId)
    .eq('id', staffId)
    .select('id, code, name, role, role_title, department, access_role, avatar_initials, last_login, permissions, terminal_access, is_active')
    .single();
  if (error || !data) {
    if (error?.code === 'PGRST116') throw new ApiError(404, 'Staff member not found');
    throw new ApiError(502, 'Failed to update staff member in Supabase', 'SUPABASE_WRITE_FAILED');
  }
  return data;
}

router.post(
  '/:id/deactivate',
  asyncHandler(async (req, res) => {
    const client = requireSupabase();
    const data = await setActive(env.tenantId, req.params.id, false, client);
    res.json(rowToStaff(data));
  })
);

router.post(
  '/:id/reactivate',
  asyncHandler(async (req, res) => {
    const client = requireSupabase();
    const data = await setActive(env.tenantId, req.params.id, true, client);
    res.json(rowToStaff(data));
  })
);

export default router;
