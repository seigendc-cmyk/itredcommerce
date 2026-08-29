import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler, ApiError } from './http';
import { generateId } from './ids';

/**
 * Generic JSON-record CRUD router backed by the shared `generic_records`
 * table. Used for reference/config domains that are simple display+edit
 * lists (devices, payment method config, custom field defs, etc.) rather
 * than heavily-joined transactional entities.
 */
export function createCrudRouter(domain: string, idPrefix: string) {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const rows = db
        .prepare('SELECT id, data, created_at, updated_at FROM generic_records WHERE domain = ? ORDER BY created_at ASC')
        .all(domain) as any[];
      res.json(rows.map((r) => ({ ...JSON.parse(r.data), id: r.id })));
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const row = db
        .prepare('SELECT id, data FROM generic_records WHERE domain = ? AND id = ?')
        .get(domain, req.params.id) as any;
      if (!row) throw new ApiError(404, `${domain} record not found`);
      res.json({ ...JSON.parse(row.data), id: row.id });
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const id = req.body.id || generateId(idPrefix);
      const payload = { ...req.body, id };
      db.prepare(
        'INSERT INTO generic_records (domain, id, data) VALUES (?, ?, ?)'
      ).run(domain, id, JSON.stringify(payload));
      res.status(201).json(payload);
    })
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const existing = db
        .prepare('SELECT id FROM generic_records WHERE domain = ? AND id = ?')
        .get(domain, req.params.id);
      if (!existing) throw new ApiError(404, `${domain} record not found`);
      const payload = { ...req.body, id: req.params.id };
      db.prepare(
        "UPDATE generic_records SET data = ?, updated_at = datetime('now') WHERE domain = ? AND id = ?"
      ).run(JSON.stringify(payload), domain, req.params.id);
      res.json(payload);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const result = db
        .prepare('DELETE FROM generic_records WHERE domain = ? AND id = ?')
        .run(domain, req.params.id);
      if (result.changes === 0) throw new ApiError(404, `${domain} record not found`);
      res.status(204).send();
    })
  );

  return router;
}

/** Read/write helpers for a single-row "singleton" config domain (e.g. licence info). */
export function getSingleton<T = any>(domain: string): T | null {
  const row = db
    .prepare('SELECT data FROM generic_records WHERE domain = ? AND id = ?')
    .get(domain, 'SINGLETON') as any;
  return row ? JSON.parse(row.data) : null;
}

export function setSingleton(domain: string, data: any) {
  const existing = db
    .prepare('SELECT id FROM generic_records WHERE domain = ? AND id = ?')
    .get(domain, 'SINGLETON');
  if (existing) {
    db.prepare(
      "UPDATE generic_records SET data = ?, updated_at = datetime('now') WHERE domain = ? AND id = ?"
    ).run(JSON.stringify(data), domain, 'SINGLETON');
  } else {
    db.prepare('INSERT INTO generic_records (domain, id, data) VALUES (?, ?, ?)').run(
      domain,
      'SINGLETON',
      JSON.stringify(data)
    );
  }
}
