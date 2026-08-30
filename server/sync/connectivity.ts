// Connectivity as one explicit, subscribable signal (DL-008), rather than
// implicit online/offline checks scattered across the app. The drain loop
// subscribes to this; so should any future UI that needs to react to
// connectivity precisely (e.g. Prompt 7's dispatch-creation button).

import type { ConnectivityState } from './types';

type Listener = (state: ConnectivityState) => void;

export class ConnectivityMonitor {
  private state: ConnectivityState = 'OFFLINE';
  private listeners = new Set<Listener>();

  /** `probe` should resolve true if connectivity is currently up. Injectable for testing. */
  constructor(private probe: () => Promise<boolean>) {}

  getState(): ConnectivityState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Runs the probe once and updates state, notifying subscribers only on an actual state change. */
  async checkNow(): Promise<ConnectivityState> {
    let isUp: boolean;
    try {
      isUp = await this.probe();
    } catch {
      isUp = false;
    }
    const next: ConnectivityState = isUp ? 'ONLINE' : 'OFFLINE';
    if (next !== this.state) {
      this.state = next;
      for (const listener of this.listeners) listener(next);
    }
    return this.state;
  }
}

/** Thin polling wrapper around checkNow(). Returns a stop function. */
export function startPolling(monitor: ConnectivityMonitor, intervalMs: number): () => void {
  const handle = setInterval(() => {
    void monitor.checkNow();
  }, intervalMs);
  return () => clearInterval(handle);
}
