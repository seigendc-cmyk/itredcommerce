import { useEffect, useState } from 'react';
import { apiGet } from '../api/client';

export type ConnectivityState = 'ONLINE' | 'OFFLINE';

const POLL_INTERVAL_MS = 8000;

/**
 * Polls the server's DL-008 connectivity signal (GET /api/connectivity)
 * rather than trusting navigator.onLine, which only reflects the local
 * network link, not whether Supabase itself is actually reachable. Starts
 * OFFLINE (fail-safe) until the first successful poll confirms otherwise —
 * a CTA gated on this should stay disabled during that initial window.
 */
export function useConnectivity(): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>('OFFLINE');

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const result = await apiGet<{ state: ConnectivityState }>('/connectivity');
        if (!cancelled) setState(result.state);
      } catch {
        if (!cancelled) setState('OFFLINE');
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return state;
}
