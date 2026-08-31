// Single shared ConnectivityMonitor instance for this process (DL-008).
// server/index.ts starts it polling at boot; server/routes/connectivity.ts
// exposes its cached state to the client for the delivery dispatch CTA
// (and any future UI); server/routes/deliveryOrders.ts calls checkNow()
// directly for a fresh read immediately before writing, rather than
// trusting a possibly-stale poll, since a dispatch can never be queued.

import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { isSupabaseConfigured } from '../env';
import { ConnectivityMonitor } from './connectivity';

const PROBE_TIMEOUT_MS = 4000;

async function probeSupabase(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const client = getSupabaseAdmin();
  if (!client) return false;

  const probePromise = client.from('tenants').select('id').limit(1);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('connectivity probe timed out')), PROBE_TIMEOUT_MS);
  });

  const { error } = await Promise.race([probePromise, timeoutPromise]);
  return !error;
}

export const connectivityMonitor = new ConnectivityMonitor(probeSupabase);
