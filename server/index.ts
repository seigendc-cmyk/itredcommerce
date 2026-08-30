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

runMigrations();
seedIfEmpty();

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
