import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import memos from './memos';
import orders from './orders';
import receipts from './receipts';

const router = Router();
router.use(requireAuth);
router.use('/memos', memos);
router.use('/orders', orders);
router.use('/receipts', receipts);

export default router;
