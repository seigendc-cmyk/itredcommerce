import { getSupabaseAdmin } from './supabaseAdmin';
import { env } from '../env';

// Shared shape both the Supabase RPC path and the local-cache fallback path
// map into, so server/routes/auth.ts doesn't need two parallel response
// builders. Deliberately never carries pin_hash.
export interface VerifiedStaff {
  id: string;
  code: string;
  name: string;
  role: string;
  roleTitle: string;
  department: string | null;
  accessRole: string;
  avatarInitials: string | null;
  permissions: string[];
  terminalAccess: string[];
  lastLogin: string | null;
}

export type PinVerifyResult =
  | { outcome: 'SUCCESS'; staff: VerifiedStaff }
  | { outcome: 'INVALID' }
  | { outcome: 'LOCKED_OUT' }
  | { outcome: 'UNREACHABLE' };

const RPC_TIMEOUT_MS = 5000;

/**
 * Calls the verify_staff_pin SECURITY DEFINER RPC (Postgres — see
 * supabase/migrations/20260830150000_staff_pin_verification.sql). The RPC
 * reports INVALID/LOCKED_OUT via a `status` column on its one returned row,
 * not via a thrown Postgres error — an earlier version used `raise
 * exception` for this and it was a real bug (caught during manual testing):
 * raising rolls back everything the function itself wrote in the same call,
 * which silently undid the failed_attempts counter it's supposed to
 * persist. So here, `error` being set means something genuinely went wrong
 * at the transport/function level (network failure, timeout, RPC not
 * found, etc.) — never a real auth verdict — and always falls back to
 * local verification rather than being treated as "PIN is wrong." Only the
 * RPC's own `status` field is ever surfaced as INVALID/LOCKED_OUT. This is
 * the boundary that keeps an attacker from forcing a downgrade to the
 * (less centrally-rate-limited) local path by tampering with the
 * connection.
 */
export async function verifyPinAgainstSupabase(staffId: string, pin: string): Promise<PinVerifyResult> {
  const client = getSupabaseAdmin();
  if (!client) return { outcome: 'UNREACHABLE' };

  try {
    const rpcPromise = client.rpc('verify_staff_pin', {
      p_tenant_id: env.tenantId,
      p_staff_id: staffId,
      p_pin: pin,
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('verify_staff_pin timed out')), RPC_TIMEOUT_MS);
    });
    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);

    if (error) {
      console.error('[staffAuth] verify_staff_pin returned an unexpected error — treating as unreachable:', error);
      return { outcome: 'UNREACHABLE' };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      console.error('[staffAuth] verify_staff_pin returned no rows — treating as unreachable');
      return { outcome: 'UNREACHABLE' };
    }

    if (row.status === 'LOCKED_OUT') return { outcome: 'LOCKED_OUT' };
    if (row.status === 'INVALID') return { outcome: 'INVALID' };
    if (row.status !== 'OK') {
      console.error('[staffAuth] verify_staff_pin returned an unrecognized status — treating as unreachable:', row.status);
      return { outcome: 'UNREACHABLE' };
    }

    return {
      outcome: 'SUCCESS',
      staff: {
        id: row.id,
        code: row.code,
        name: row.name,
        role: row.role,
        roleTitle: row.role_title,
        department: row.department,
        // Casing reconciliation (DL-009/DL-011): Postgres's app_staff_role
        // enum is lowercase ('till_operator'); every client-side gate
        // (src/utils/accessRoleGate.ts) and the local SQLite cache compare
        // against the UPPER_SNAKE_CASE StaffAccessRole values instead.
        accessRole: typeof row.access_role === 'string' ? row.access_role.toUpperCase() : row.access_role,
        avatarInitials: row.avatar_initials,
        permissions: row.permissions || [],
        terminalAccess: row.terminal_access || [],
        lastLogin: row.last_login,
      },
    };
  } catch (err) {
    console.error('[staffAuth] verify_staff_pin call failed — falling back to local cache:', err);
    return { outcome: 'UNREACHABLE' };
  }
}
