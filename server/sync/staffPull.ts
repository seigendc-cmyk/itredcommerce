import { db, withTransaction } from '../db/connection';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { env } from '../env';

// Pull-only counterpart to the outbox drain loop (which only pushes). Under
// DL-005/DL-011, Supabase is the source of truth for staff — local SQLite's
// staff table becomes a read-through cache, refreshed here, used only for
// offline PIN-fallback and roster display. Unlike every other synced table,
// staff is never written locally-first through the outbox (see DL-011 —
// staff administration is a connected-only operation).
export async function pullStaffFromSupabase(): Promise<{ pulled: number } | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;

  const { data, error } = await client
    .from('staff')
    .select('id, code, name, role, role_title, department, access_role, pin_hash, avatar_initials, last_login, permissions, terminal_access, is_active')
    .eq('tenant_id', env.tenantId);

  if (error || !data) {
    console.error('[staffPull] failed to pull staff from Supabase:', error);
    return null;
  }

  const upsert = db.prepare(`
    INSERT INTO staff (id, code, name, role, role_title, department, access_role, pin_hash, avatar_initials, last_login, permissions, terminal_access, is_active)
    VALUES (@id, @code, @name, @role, @role_title, @department, @access_role, @pin_hash, @avatar_initials, @last_login, @permissions, @terminal_access, @is_active)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      name = excluded.name,
      role = excluded.role,
      role_title = excluded.role_title,
      department = excluded.department,
      access_role = excluded.access_role,
      pin_hash = excluded.pin_hash,
      avatar_initials = excluded.avatar_initials,
      last_login = excluded.last_login,
      permissions = excluded.permissions,
      terminal_access = excluded.terminal_access,
      is_active = excluded.is_active
  `);

  withTransaction(() => {
    for (const row of data) {
      upsert.run({
        id: row.id,
        code: row.code,
        name: row.name,
        role: row.role,
        role_title: row.role_title,
        department: row.department ?? null,
        // Casing reconciliation (DL-009): Postgres's app_staff_role enum is
        // lowercase, local SQLite's access_role column is UPPER_SNAKE_CASE.
        access_role: typeof row.access_role === 'string' ? row.access_role.toUpperCase() : row.access_role,
        pin_hash: row.pin_hash,
        avatar_initials: row.avatar_initials ?? null,
        last_login: row.last_login ?? null,
        permissions: JSON.stringify(row.permissions ?? []),
        terminal_access: JSON.stringify(row.terminal_access ?? []),
        is_active: row.is_active ? 1 : 0,
      });
    }
  });

  console.log(`[staffPull] synced ${data.length} staff row(s) from Supabase`);
  return { pulled: data.length };
}
