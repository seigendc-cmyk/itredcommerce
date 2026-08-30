import { supabase } from './supabaseClient';

// Mirrors ABSOLUTE_SESSION_CEILING_MS in the Tauri apps' session model
// (server/middleware/session.ts) for consistency, per DL-013's session-TTL
// decision: Supabase's own access token expires/refreshes on its own
// schedule (default 1h, refresh-token rotation), but this app additionally
// enforces its own 12h absolute ceiling on top of that — past 12h, force a
// full PIN re-entry rather than a silent refresh, regardless of whether the
// underlying Supabase session is still technically refreshable.
const ABSOLUTE_SESSION_CEILING_MS = 12 * 60 * 60 * 1000;
const SIGNED_IN_AT_KEY = 'itred-executive-signed-in-at';

export function recordSignIn(): void {
  localStorage.setItem(SIGNED_IN_AT_KEY, String(Date.now()));
}

export function clearSignInRecord(): void {
  localStorage.removeItem(SIGNED_IN_AT_KEY);
}

export function isPastAbsoluteCeiling(): boolean {
  const raw = localStorage.getItem(SIGNED_IN_AT_KEY);
  if (!raw) return false;
  const signedInAt = Number(raw);
  if (!Number.isFinite(signedInAt)) return true;
  return Date.now() - signedInAt > ABSOLUTE_SESSION_CEILING_MS;
}

/**
 * Call once at app startup and periodically thereafter. Forces a real
 * sign-out (clearing the Supabase session, not just the local flag) once
 * the 12h ceiling passes, so a stale tab can't keep using a technically-
 * still-valid refresh token past that point.
 */
export async function enforceSessionCeiling(): Promise<boolean> {
  if (isPastAbsoluteCeiling()) {
    clearSignInRecord();
    await supabase.auth.signOut();
    return true;
  }
  return false;
}
