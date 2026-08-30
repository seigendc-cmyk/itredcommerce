import { env } from './env';

export interface RosterEntry {
  id: string;
  name: string;
  avatarInitials: string;
  roleTitle: string;
}

export class ExecAuthError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const functionsBase = `${env.supabaseUrl}/functions/v1`;

async function callFunction<T>(name: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${functionsBase}/${name}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: env.supabaseAnonKey,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ExecAuthError(res.status, body?.error || res.statusText, body?.code);
  }
  return body as T;
}

// Unauthenticated by design (mirrors GET /auth/staff's existing precedent
// in the main app — names/avatar initials only, never anything sensitive).
export function fetchExecutiveRoster(): Promise<RosterEntry[]> {
  return callFunction<RosterEntry[]>(`executive-roster?tenantId=${encodeURIComponent(env.tenantId)}`, { method: 'GET' });
}

export interface ExecutiveSignInResult {
  accessToken: string;
  refreshToken: string;
  staff: {
    id: string;
    name: string;
    roleTitle: string;
    avatarInitials: string;
  };
}

export function signInExecutive(staffId: string, pin: string): Promise<ExecutiveSignInResult> {
  return callFunction<ExecutiveSignInResult>('executive-signin', {
    method: 'POST',
    body: JSON.stringify({ tenantId: env.tenantId, staffId, pin }),
  });
}
