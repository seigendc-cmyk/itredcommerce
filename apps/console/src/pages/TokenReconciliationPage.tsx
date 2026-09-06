import React, { useEffect, useState } from 'react';
import { ConsoleShell } from '../components/ConsoleShell';
import {
  listTenants,
  listTerminalActivationTokens,
  listTerminalActivationConfirmations,
  type TenantRow,
} from '../lib/consoleApi';
import { reconcileTerminalActivationTokens, type TokenReconciliationRow } from '../lib/tokenReconciliation';

// DL-042/DL-057: audit view over the console's own issuance ledger
// (terminal_activation_tokens) against the tenant's independently-kept
// activation ledger (terminal_activation_confirmations) — never a single
// point of failure per DL-042. "Awaiting confirmation" is expected and
// often transient (a token issued moments ago, or relayed to a tenant who
// hasn't pasted it in yet); this view surfaces it for audit visibility,
// it doesn't imply anything is wrong on its own.
export const TokenReconciliationPage: React.FC = () => {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [rows, setRows] = useState<TokenReconciliationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const tenantRows = await listTenants();
        setTenants(tenantRows);
        if (tenantRows.length > 0) setSelectedTenantId(tenantRows[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedTenantId) return;
    (async () => {
      setError(null);
      try {
        const [tokens, confirmations] = await Promise.all([
          listTerminalActivationTokens(selectedTenantId),
          listTerminalActivationConfirmations(selectedTenantId),
        ]);
        setRows(reconcileTerminalActivationTokens(tokens, confirmations));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [selectedTenantId]);

  return (
    <ConsoleShell
      title="Token Reconciliation"
      description="Issued TerminalActivationTokens against the tenant's own activation ledger — two independent logs, per DL-042."
    >
      {error && <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2 mb-4">{error}</p>}

      <div className="mb-4">
        <select
          value={selectedTenantId}
          onChange={(e) => setSelectedTenantId(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-sm text-slate-100"
        >
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.display_name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No TerminalActivationTokens issued to this tenant yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.token.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-100">Terminal {row.token.terminal_id}</p>
                  <p className="text-xs text-slate-500">
                    Issued {new Date(row.token.issued_at).toLocaleString()} · plan {row.token.plan_tier} · expires{' '}
                    {new Date(row.token.expires_at).toLocaleString()}
                  </p>
                  {row.confirmation && (
                    <p className="text-xs text-slate-500">
                      Confirmed {new Date(row.confirmation.confirmed_at).toLocaleString()} ({row.confirmation.event_type})
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                    row.status === 'confirmed' ? 'bg-emerald-950/60 text-emerald-300' : 'bg-amber-950/60 text-amber-300'
                  }`}
                >
                  {row.status === 'confirmed' ? 'confirmed' : 'awaiting confirmation'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </ConsoleShell>
  );
};
