import { Router } from 'express';
import { db } from '../db/connection';
import { asyncHandler } from '../lib/http';
import { requireAuth } from '../middleware/auth';

// No branches router existed before Prompt 11 — added for the
// Fiscalization Settings section's branch selector (fiscal registration is
// branch-scoped). Plain read of the local branches table, same shape as
// other simple list endpoints (e.g. rateConfig.ts's GET /).
const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT id, code, name, city, status FROM branches ORDER BY name ASC').all() as any[];
    res.json(
      rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        city: r.city,
        status: r.status,
      }))
    );
  })
);

export default router;
