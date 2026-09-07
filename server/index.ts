import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { env } from './env';
import { runMigrations } from './db/migrate';
import { seedIfEmpty } from './db/seed';
import { db } from './db/connection';
import { backfillOpeningBalances } from './lib/debtorLedger';
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
import eodRouter from './routes/eod';
import deliveryOrdersRouter from './routes/deliveryOrders';
import connectivityRouter from './routes/connectivity';
import fiscalizationRouter from './routes/fiscalization';
import zimraFiscalRouter from './routes/zimraFiscal';
import branchesRouter from './routes/branches';
import licensingRouter from './routes/licensing';
import onboardingRouter from './routes/onboarding';
import businessProfileRouter from './routes/businessProfile';
import biRulesRouter from './routes/biRules';
import approvalsRouter from './routes/approvals';
import { isSupabaseConfigured } from './env';
import { pullStaffFromSupabase } from './sync/staffPull';
import { pullFiscalRegistrationsFromSupabase } from './sync/fiscalRegistrationPull';
import { pullTenantFromSupabase } from './sync/tenantPull';
import { pullTerminalActivationTokenFromSupabase } from './sync/terminalActivationTokenPull';
import { pullBiRulesFromSupabase } from './sync/biRulesPull';
import { connectivityMonitor } from './sync/connectivityInstance';
import { startPolling } from './sync/connectivity';
import { startFiscalDrainLoop } from './sync/fiscalDrainLoop';
import { startFiscalBackfillSweep } from './sync/fiscalBackfillSweep';
import { startTerminalActivationConfirmationDrainLoop } from './sync/terminalActivationConfirmationDrainLoop';
import { startBiRuleSettingsPush } from './sync/biRuleSettingsPush';
import { startBiRuleGatedActionReconciler } from './sync/biRuleGatedActionReconciler';
import { bootstrapTenantIdFromLocal } from './lib/installationConfig';

runMigrations();
// Mock-data seeding is a dev/demo convenience for the shared dev database —
// never appropriate for a packaged install, where an empty `staff` table
// means a genuinely fresh customer install waiting for onboarding, not an
// empty dev DB waiting for demo data. `npm run dev`/`tsx` always run with
// NODE_ENV=development; the packaged Tauri sidecar always sets
// NODE_ENV=production (see src-tauri/src/sidecar.rs).
if (!env.isProduction) {
  seedIfEmpty();
}

// DL-069/084 (Prompt 15): one-time-per-customer opening-balance backfill,
// run after seeding so dev/demo customers get a real ledger row too, not
// just production installs. Cheap no-op on every subsequent boot once every
// existing customer has been covered — see debtorLedger.ts's header comment.
backfillOpeningBalances(db);

// A fresh install has no TENANT_ID env var — if the Business Profile
// onboarding wizard already ran in a previous process (this is a restart,
// not a first boot), the tenant this install is bound to lives in local
// SQLite's installation_config singleton instead. See
// server/lib/installationConfig.ts.
bootstrapTenantIdFromLocal();

// Fiscal submissions get their own tighter-cadence drain loop, separate
// from the general outbox — see server/sync/fiscalDrainLoop.ts's header
// comment for why. Unlike the pull loops below, this one doesn't depend on
// isSupabaseConfigured() at start time — it already checks per-submission.
startFiscalDrainLoop();
startFiscalBackfillSweep();

// DL-057's two-ledger reconciliation push, same "own dedicated loop, not
// the general outbox" reasoning as the fiscal drain loop above — checks
// connectivity per tick itself, so like that one it doesn't need to wait
// for isSupabaseConfigured() at start time either.
startTerminalActivationConfirmationDrainLoop();

// DL-058-063 BI Brain: pull-cache refresh + reconciliation (same cadence
// class as staff/tenant pulls above), its own dirty-flag push loop (same
// "own small loop, not the dead general outbox" reasoning as the
// TerminalActivationToken confirmation push), and the reconnect-triggered
// gated-action reconciler (DL-062) — subscribes to the same connectivityMonitor
// signal the TerminalActivationToken pull below already does.
const BI_RULES_PULL_INTERVAL_MS = 5 * 60 * 1000;
void pullBiRulesFromSupabase();
setInterval(() => void pullBiRulesFromSupabase(), BI_RULES_PULL_INTERVAL_MS);
startBiRuleSettingsPush();
startBiRuleGatedActionReconciler();

// DL-005/DL-011/Prompt-11/DL-008's background sync jobs all depend on a
// configured tenant, which — since the Business Profile onboarding wizard
// — may not exist yet at process boot and can become configured mid-process
// once onboarding completes. Grouped into one idempotent starter so both
// boot and the onboarding-completion routes can call the same thing rather
// than duplicating the isSupabaseConfigured() gate three times.
let backgroundSyncStarted = false;
export function startBackgroundSync() {
  if (backgroundSyncStarted) return;
  if (!isSupabaseConfigured()) {
    console.log('[server] Supabase not configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/TENANT_ID) — running fully offline against local SQLite caches.');
    return;
  }
  backgroundSyncStarted = true;

  // DL-005/DL-011: refresh the local staff/PIN offline-fallback cache from
  // Supabase at startup and periodically thereafter. Best-effort — a failed
  // pull just means the cache stays at its last-known-good state, which is
  // exactly the offline-fallback behavior this cache exists for.
  const STAFF_PULL_INTERVAL_MS = 5 * 60 * 1000;
  void pullStaffFromSupabase();
  setInterval(() => void pullStaffFromSupabase(), STAFF_PULL_INTERVAL_MS);

  // Business Profile: same pull-cache shape/cadence as staff.
  const TENANT_PULL_INTERVAL_MS = 5 * 60 * 1000;
  void pullTenantFromSupabase();
  setInterval(() => void pullTenantFromSupabase(), TENANT_PULL_INTERVAL_MS);

  // Prompt 11: read-through cache of shared branch-level fiscal
  // registrations (credentials included, as ciphertext — see
  // server/lib/fiscalCrypto.ts). Same pull-cache shape/cadence as staff.
  const FISCAL_REGISTRATION_PULL_INTERVAL_MS = 5 * 60 * 1000;
  void pullFiscalRegistrationsFromSupabase();
  setInterval(() => void pullFiscalRegistrationsFromSupabase(), FISCAL_REGISTRATION_PULL_INTERVAL_MS);

  // DL-008: one shared connectivity signal, polled in the background so the
  // delivery-dispatch CTA (and any future UI) can read a cheap cached state
  // via GET /api/connectivity rather than each surface probing independently.
  const CONNECTIVITY_POLL_INTERVAL_MS = 10 * 1000;
  void connectivityMonitor.checkNow();
  startPolling(connectivityMonitor, CONNECTIVITY_POLL_INTERVAL_MS);

  // DL-039/DL-048: pull down a newer TerminalActivationToken the moment
  // connectivity is restored, piggybacking on the same connectivity signal
  // the outbox drain loop already subscribes to (server/sync/drainLoop.ts)
  // rather than adding yet another independent polling interval like the
  // pulls above — a token needs to reach the terminal as soon as it can,
  // not up to 5 minutes later.
  void pullTerminalActivationTokenFromSupabase();
  connectivityMonitor.subscribe((state) => {
    if (state === 'ONLINE') void pullTerminalActivationTokenFromSupabase();
  });
}
startBackgroundSync();

const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(sessionMiddleware);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// No requireAuth — this install has no staff/session to authenticate as
// until onboarding creates the first one. Each route inside guards itself
// against re-running once env.tenantId is already set (409 ALREADY_PROVISIONED).
app.use('/api/onboarding', onboardingRouter);
app.use('/api/business-profile', businessProfileRouter);

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
app.use('/api/eod', eodRouter);
app.use('/api/delivery-orders', deliveryOrdersRouter);
app.use('/api/connectivity', connectivityRouter);
app.use('/api/fiscalization', fiscalizationRouter);
app.use('/api/zimra', zimraFiscalRouter);
app.use('/api/branches', branchesRouter);
app.use('/api/licensing', licensingRouter);
app.use('/api/bi-rules', biRulesRouter);
app.use('/api/approvals', approvalsRouter);

// --- Additional route modules are mounted here as milestones land ---

// Any /api/* request that reached here matched no route — respond JSON 404
// (scoped to /api so it never shadows the SPA static/catch-all below).
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (env.isProduction) {
  const distDir = env.distDir;
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
