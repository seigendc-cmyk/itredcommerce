let counter = 0;

/** Monotonic-ish unique id: timestamp + in-process counter, avoids collisions
 * when multiple ids are generated within the same millisecond. */
export function generateId(prefix: string): string {
  counter = (counter + 1) % 100000;
  return `${prefix}-${Date.now()}-${counter.toString().padStart(5, '0')}`;
}

export function generateDocumentNumber(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  counter = (counter + 1) % 100000;
  return `${prefix}-${y}${m}${d}-${counter.toString().padStart(4, '0')}`;
}

export function nowIso(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
