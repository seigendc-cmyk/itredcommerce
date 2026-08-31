import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { env } from './env';
import { runMigrations } from './db/migrate';
import { seedIfEmpty } from './db/seed';
import { sessionMiddleware } from './middleware/session';
import { ApiError } from './lib/http';
import authRouter from './routes/auth';
import inventoryRouter from './routes/inventory';
import customersRouter from './routes/customers';
import shiftsRouter from './routes/shifts';
import salesRouter from './routes/sales';
import heldSalesRouter from './routes/heldSales';
import heldReceiptsRouter from './routes/heldReceipts';
import creditNotesRouter from './routes/creditNotes';
import purchasingRouter from './routes/purchasing';
import stockTransfersRouter from './routes/stockTransfers';
import stocktakeRouter from './routes/stocktake';
import rateConfigRouter from './routes/rateConfig';
import staffRouter from './routes/staff';
import deliveryOrdersRouter from './routes/deliveryOrders';
import connectivityRouter from './routes/connectivity';
import fiscalizationRouter from './routes/fiscalization';
import branchesRouter from './routes/branches';
import { isSupabaseConfigured } from './env';
import { pullStaffFromSupabase } from './sync/staffPull';
import { pullFiscalRegistrationsFromSupabase } from './sync/fiscalRegistrationPull';
import { connectivityMonitor } from './sync/connectivityInstance';
import { startPolling } from './sync/connectivity';
import { startFiscalDrainLoop } from './sync/fiscalDrainLoop';

runMigrations();
seedIfEmpty();

// DL-005/DL-011: refresh the local staff/PIN offline-fallback cache from
// Supabase at startup and periodically thereafter. Best-effort — a failed
// pull just means the cache stays at its last-known-good state, which is
// exactly the offline-fallback behavior this cache exists for.
const STAFF_PULL_INTERVAL_MS = 5 * 60 * 1000;
if (isSupabaseConfigured) {
  void pullStaffFromSupabase();
  setInterval(() => void pullStaffFromSupabase(), STAFF_PULL_INTERVAL_MS);
} else {
  console.log('[server] Supabase not configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/TENANT_ID) — running fully offline against local SQLite staff cache.');
}

// Prompt 11: read-through cache of shared branch-level fiscal
// registrations (credentials included, as ciphertext — see
// server/lib/fiscalCrypto.ts). Same pull-cache shape/cadence as staff.
const FISCAL_REGISTRATION_PULL_INTERVAL_MS = 5 * 60 * 1000;
if (isSupabaseConfigured) {
  void pullFiscalRegistrationsFromSupabase();
  setInterval(() => void pullFiscalRegistrationsFromSupabase(), FISCAL_REGISTRATION_PULL_INTERVAL_MS);
}

// Fiscal submissions get their own tighter-cadence drain loop, separate
// from the general outbox — see server/sync/fiscalDrainLoop.ts's header
// comment for why.
startFiscalDrainLoop();

// DL-008: one shared connectivity signal, polled in the background so the
// delivery-dispatch CTA (and any future UI) can read a cheap cached state
// via GET /api/connectivity rather than each surface probing independently.
const CONNECTIVITY_POLL_INTERVAL_MS = 10 * 1000;
if (isSupabaseConfigured) {
  void connectivityMonitor.checkNow();
  startPolling(connectivityMonitor, CONNECTIVITY_POLL_INTERVAL_MS);
}

const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(sessionMiddleware);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/customers', customersRouter);
app.use('/api/shifts', shiftsRouter);
app.use('/api/sales', salesRouter);
app.use('/api/held-sales', heldSalesRouter);
app.use('/api/held-receipts', heldReceiptsRouter);
app.use('/api/credit-notes', creditNotesRouter);
app.use('/api/purchasing', purchasingRouter);
app.use('/api/transfers', stockTransfersRouter);
app.use('/api/stocktake', stocktakeRouter);
app.use('/api/rate-config', rateConfigRouter);
app.use('/api/staff', staffRouter);
app.use('/api/delivery-orders', deliveryOrdersRouter);
app.use('/api/connectivity', connectivityRouter);
app.use('/api/fiscalization', fiscalizationRouter);
app.use('/api/branches', branchesRouter);

// --- Additional route modules are mounted here as milestones land ---

// Any /api/* request that reached here matched no route — respond JSON 404
// (scoped to /api so it never shadows the SPA static/catch-all below).
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (env.isProduction) {
  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }
}

// Centralized error handler — keep last.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(env.apiPort, () => {
  console.log(`[server] iTred Commerce API listening on http://localhost:${env.apiPort}`);
});
