import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '../api/client';

export type ModuleLockStatus = 'valid' | 'expired-in-grace' | 'expired-locked' | 'not-activated';

export interface ModuleLockState {
  locked: boolean;
  status: ModuleLockStatus;
  graceDaysRemaining: number | null;
}

interface LicensingStatusResponse {
  activated: boolean;
  status?: 'valid' | 'expired-in-grace' | 'expired-locked' | 'invalid-signature' | 'identity-mismatch';
  graceDaysRemaining?: number | null;
}

const NOT_LOCKED: ModuleLockState = { locked: false, status: 'not-activated', graceDaysRemaining: null };

// DL-040/DL-048. Polled at launch and every 15 minutes thereafter — cheap,
// since GET /api/licensing/status is a purely local, already-offline-
// evaluated check (server/lib/terminalActivationToken.ts), not a network
// round trip to Supabase — so a terminal left open across the grace-period
// boundary still transitions to locked without needing a restart. Callers
// should also invoke `refresh()` on navigation into a Sales/Purchasing view
// for the same reason (DL-040's own "not just once at startup" concern).
//
// A terminal with no TerminalActivationToken at all (`activated: false`) is
// deliberately NOT locked here — DL-040 describes the lock as something
// that engages once an issued token *expires*, not a gate on ever having
// had one, and the WhatsApp request/console-issuance loop that would let a
// fresh install obtain its first token isn't built yet (DL-041, later
// prompts). Locking every never-activated install by default would disable
// Sales on every existing/dev/demo install with no way to recover.
const POLL_INTERVAL_MS = 15 * 60 * 1000;

export function useModuleLock(): ModuleLockState & { refresh: () => void } {
  const [state, setState] = useState<ModuleLockState>(NOT_LOCKED);
  const cancelledRef = useRef(false);

  const refresh = useCallback(() => {
    void (async () => {
      try {
        const res = await apiGet<LicensingStatusResponse>('/licensing/status');
        if (cancelledRef.current) return;
        if (!res.activated || (res.status !== 'valid' && res.status !== 'expired-in-grace' && res.status !== 'expired-locked')) {
          setState(NOT_LOCKED);
          return;
        }
        setState({
          locked: res.status === 'expired-locked',
          status: res.status,
          graceDaysRemaining: res.graceDaysRemaining ?? null,
        });
      } catch {
        // A failed check (transient local API error) leaves the previous
        // state in place rather than guessing either way — this endpoint
        // never leaves the local machine, so a failure here means the
        // local API itself is unreachable, not that licensing state
        // actually changed.
      }
    })();
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, [refresh]);

  return { ...state, refresh };
}
