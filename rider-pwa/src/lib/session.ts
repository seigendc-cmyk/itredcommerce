import { supabase } from './supabaseClient';

// Same 12h absolute-ceiling policy as the Executive PWA (DL-013) — a
// technically-still-refreshable Supabase session shouldn't outlive it just
// because the tab/app was left open. Not explicitly re-specified by this
// prompt, so reusing the already-established precedent rather than
// inventing a second session-TTL policy.
const ABSOLUTE_SESSION_CEILING_MS = 12 * 60 * 60 * 1000;
const SIGNED_IN_AT_KEY = 'itred-rider-signed-in-at';

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

export async function enforceSessionCeiling(): Promise<boolean> {
  if (isPastAbsoluteCeiling()) {
    clearSignInRecord();
    await supabase.auth.signOut();
    return true;
  }
  return false;
}
