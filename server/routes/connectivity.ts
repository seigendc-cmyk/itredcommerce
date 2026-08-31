import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { connectivityMonitor } from '../sync/connectivityInstance';

const router = Router();
router.use(requireAuth);

// DL-008: the one explicit connectivity signal every surface reads instead
// of guessing at online/offline independently. Returns the monitor's last
// polled state (cheap, no live probe on every request) — callers that need
// a guaranteed-fresh read before an irreversible action (delivery dispatch
// creation) call connectivityMonitor.checkNow() directly instead.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ state: connectivityMonitor.getState() });
  })
);

export default router;
