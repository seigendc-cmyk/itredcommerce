import { Request, Response, NextFunction } from 'express';
import { db } from '../db/connection';
import { ApiError } from '../lib/http';
import { hasRole, StaffRole } from '../lib/roles';
import { hasAccessRole, StaffAccessRole } from '../lib/accessRoles';
import { ABSOLUTE_SESSION_CEILING_MS } from './session';

export interface AuthedStaff {
  id: string;
  code: string;
  name: string;
  role: StaffRole;
  roleTitle: string;
  department: string;
  accessRole: StaffAccessRole;
  avatarInitials: string;
  permissions: string[];
  terminalAccess: string[];
}

declare global {
  namespace Express {
    interface Request {
      currentStaff?: AuthedStaff;
    }
  }
}

function rowToStaff(row: any): AuthedStaff {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    role: row.role,
    roleTitle: row.role_title,
    department: row.department,
    accessRole: row.access_role,
    avatarInitials: row.avatar_initials,
    permissions: JSON.parse(row.permissions || '[]'),
    terminalAccess: JSON.parse(row.terminal_access || '[]'),
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.session.staffId || !req.session.loginAt) {
    throw new ApiError(401, 'Not authenticated', 'NOT_AUTHENTICATED');
  }
  if (Date.now() - req.session.loginAt > ABSOLUTE_SESSION_CEILING_MS) {
    req.session.destroy(() => {});
    throw new ApiError(401, 'Session expired, please sign in again', 'SESSION_EXPIRED');
  }

  const row = db
    .prepare('SELECT * FROM staff WHERE id = ? AND is_active = 1')
    .get(req.session.staffId) as any;
  if (!row) {
    throw new ApiError(401, 'Staff account no longer active', 'STAFF_INACTIVE');
  }

  req.currentStaff = rowToStaff(row);
  next();
}

export function requireRole(...allowed: StaffRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.currentStaff || !hasRole(req.currentStaff.role, ...allowed)) {
      throw new ApiError(403, 'Insufficient permissions for this action', 'FORBIDDEN');
    }
    next();
  };
}

// DL-002/DL-005 app-surface gate: distinct from requireRole above (which
// checks the free-form job-title StaffRole). This checks the controlled
// StaffAccessRole vocabulary that decides which app surface (branch
// terminal vs. head office, etc.) a route belongs to.
export function requireAccessRole(...allowed: StaffAccessRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.currentStaff || !hasAccessRole(req.currentStaff.accessRole, ...allowed)) {
      throw new ApiError(403, 'Insufficient access scope for this action', 'FORBIDDEN_ACCESS_ROLE');
    }
    next();
  };
}
