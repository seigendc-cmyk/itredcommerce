// Exponential backoff with jitter (DL-006). Pure function — no timers, no
// I/O — so it's trivially unit-testable and the drain loop just calls it.

export interface BackoffOptions {
  baseDelayMs: number;
  maxDelayMs: number;
  /** Full jitter fraction in [0, 1]: 0 = no jitter, 1 = delay is uniformly random in [0, cappedDelay]. */
  jitterFraction: number;
}

export const DEFAULT_BACKOFF_OPTIONS: BackoffOptions = {
  baseDelayMs: 1_000,
  maxDelayMs: 5 * 60_000,
  jitterFraction: 1,
};

/**
 * attempt is 1-based: the delay to wait *before* the Nth retry, given
 * attemptCount failures so far. attempt=1 means "one failure has happened,
 * this is the delay before the next try."
 */
export function computeBackoffDelayMs(
  attempt: number,
  options: BackoffOptions = DEFAULT_BACKOFF_OPTIONS,
  random: () => number = Math.random
): number {
  if (attempt < 1) return 0;
  const uncapped = options.baseDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(uncapped, options.maxDelayMs);
  const jitterRange = capped * options.jitterFraction;
  const jittered = capped - jitterRange + random() * jitterRange;
  return Math.round(jittered);
}
