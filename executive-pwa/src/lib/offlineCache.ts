const PREFIX = 'execpwa:cache:';

export interface CacheEnvelope<T> {
  data: T;
  cachedAt: string;
}

// Per-viewer browser-storage fallback for the app-shell PWA offline
// requirement: this app has no offline durability (read-only, Supabase-only,
// DL-002/DL-013) — but a lost connection should show the last successfully
// fetched rollup, not a blank screen. Never a source of truth; only ever
// consulted when a live fetch just failed.
export function readCache<T>(key: string): CacheEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, cachedAt: new Date().toISOString() }));
  } catch {
    // storage unavailable/full — page still works, just without an offline fallback for this key
  }
}
