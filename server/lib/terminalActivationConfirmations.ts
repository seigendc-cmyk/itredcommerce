import { db } from '../db/connection';

export type TerminalActivationConfirmationEventType = 'manual_paste' | 'sync_down';

export interface RecordTerminalActivationConfirmationParams {
  tenantId: string;
  terminalId: string;
  tokenIssuedAt: string;
  eventType: TerminalActivationConfirmationEventType;
  confirmedAt: string;
}

// DL-057: enqueues one row for server/sync/terminalActivationConfirmationDrainLoop.ts
// to push up to Supabase's terminal_activation_confirmations table. Called
// from both places a token becomes "activated" locally — POST
// /licensing/activate-terminal (manual_paste) and
// server/sync/terminalActivationTokenPull.ts's REPLACE branch (sync_down) —
// so this is the single place that shape is written, rather than each call
// site building the INSERT itself.
export function recordTerminalActivationConfirmation(params: RecordTerminalActivationConfirmationParams): void {
  db.prepare(
    `INSERT INTO terminal_activation_confirmations (tenant_id, terminal_id, token_issued_at, event_type, confirmed_at)
     VALUES (@tenantId, @terminalId, @tokenIssuedAt, @eventType, @confirmedAt)`
  ).run(params);
}
