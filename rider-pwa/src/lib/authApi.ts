import { env } from './env';

export interface RosterEntry {
  id: string;
  name: string;
  avatarInitials: string;
  roleTitle: string;
}

export class RiderAuthError extends Error {
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
    throw new RiderAuthError(res.status, body?.error || res.statusText, body?.code);
  }
  return body as T;
}

// Unauthenticated by design, same acceptable-exposure shape as
// executive-roster (names/avatar initials only).
export function fetchRiderRoster(): Promise<RosterEntry[]> {
  return callFunction<RosterEntry[]>(`rider-roster?tenantId=${encodeURIComponent(env.tenantId)}`, { method: 'GET' });
}

export interface RiderSignInResult {
  accessToken: string;
  refreshToken: string;
  staff: {
    id: string;
    name: string;
    roleTitle: string;
    avatarInitials: string;
  };
  riderId: string;
}

export function signInRider(staffId: string, pin: string): Promise<RiderSignInResult> {
  return callFunction<RiderSignInResult>('rider-signin', {
    method: 'POST',
    body: JSON.stringify({ tenantId: env.tenantId, staffId, pin }),
  });
}
