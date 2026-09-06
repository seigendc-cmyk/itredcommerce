import React, { useEffect, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { Modal } from '@shared/components/ui/Modal';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { readCache, writeCache } from '../lib/offlineCache';
import {
  fetchCashBankAccounts,
  fetchChartOfAccounts,
  fetchCashBankTransactionsForAccount,
  type CashBankAccountRow,
  type ChartOfAccountRow,
  type CashBankTransactionRow,
} from '../lib/directQueries';

export interface BankCashPageProps {
  onBack: () => void;
}

interface CachedShape {
  accounts: CashBankAccountRow[];
  glAccounts: ChartOfAccountRow[];
}

const CACHE_KEY = 'bank-cash';

export const BankCashPage: React.FC<BankCashPageProps> = ({ onBack }) => {
  const [accounts, setAccounts] = useState<CashBankAccountRow[]>([]);
  const [glAccounts, setGlAccounts] = useState<ChartOfAccountRow[]>([]);
  const [drillAccount, setDrillAccount] = useState<CashBankAccountRow | null>(null);
  const [drillTx, setDrillTx] = useState<CashBankTransactionRow[]>([]);
  const [staleAsOf, setStaleAsOf] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchCashBankAccounts(), fetchChartOfAccounts()])
      .then(([a, g]) => {
        setAccounts(a);
        setGlAccounts(g);
        writeCache<CachedShape>(CACHE_KEY, { accounts: a, glAccounts: g });
      })
      .catch((err) => {
        const cached = readCache<CachedShape>(CACHE_KEY);
        if (cached) {
          setAccounts(cached.data.accounts);
          setGlAccounts(cached.data.glAccounts);
          setStaleAsOf(cached.cachedAt);
        } else {
          setError(err.message || 'Failed to load bank/cash accounts');
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const glById = new Map(glAccounts.map((g) => [g.id, g]));

  const openDrillDown = async (account: CashBankAccountRow) => {
    setDrillAccount(account);
    try {
      setDrillTx(await fetchCashBankTransactionsForAccount(account.id));
    } catch {
      setDrillTx([]);
    }
  };

  const columns: Column<CashBankAccountRow>[] = [
    { key: 'name', header: 'Account' },
    { key: 'account_type', header: 'Type' },
    { key: 'current_balance', header: 'Balance', align: 'right', isMono: true, render: (r) => `$${Number(r.current_balance).toLocaleString()}` },
    {
      key: 'gl_account_id',
      header: 'GL Account',
      render: (r) => {
        const gl = r.gl_account_id ? glById.get(r.gl_account_id) : null;
        return gl ? `${gl.account_code} — ${gl.account_name}` : <span className="text-slate-400 italic">Not assigned</span>;
      },
    },
    { key: 'status', header: 'Status' },
  ];

  const totalCash = accounts.reduce((s, a) => s + Number(a.current_balance), 0);

  return (
    <PageShell title="Bank & Cash Balances" onBack={onBack}>
      <div className="bg-slate-900 border border-slate-700 p-3 mb-4 inline-block">
        <div className="text-[10px] uppercase text-slate-500 font-mono">Total Cash & Bank</div>
        <div className="text-xl font-bold font-exec-mono">${totalCash.toLocaleString()}</div>
      </div>

      <p className="text-[11px] text-slate-500 mb-3">
        Click a row to drill into its Chart of Accounts linkage and recent transactions. GL linkage is a real
        account-level registry, not a full posting ledger — see governance doc DL-013.
      </p>

      {staleAsOf && <StaleDataBanner cachedAt={staleAsOf} />}
      {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : (
        <DataTable columns={columns} data={accounts} keyField="id" pageSize={15} onRowClick={openDrillDown} searchable />
      )}

      {drillAccount && (
        <Modal isOpen={!!drillAccount} onClose={() => setDrillAccount(null)} title={drillAccount.name} maxWidth="lg">
          <div className="p-4 space-y-3 text-sm text-gray-800">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-gray-500 uppercase text-[10px]">Balance</div>
                <div className="font-bold font-mono">${Number(drillAccount.current_balance).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500 uppercase text-[10px]">GL Account</div>
                <div className="font-bold">
                  {drillAccount.gl_account_id
                    ? `${glById.get(drillAccount.gl_account_id)?.account_code ?? ''} — ${glById.get(drillAccount.gl_account_id)?.account_name ?? ''}`
                    : 'Not assigned'}
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase text-gray-600 mb-2">Recent Transactions</div>
              {drillTx.length === 0 ? (
                <div className="text-xs text-gray-400">No transactions found.</div>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-200 text-xs">
                  {drillTx.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-2">
                      <div>
                        <div className="font-mono text-gray-500">{tx.date_time}</div>
                        <div>{tx.movement_type}{tx.description ? ` — ${tx.description}` : ''}</div>
                      </div>
                      <div className="font-mono font-bold">${Number(tx.amount).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </PageShell>
  );
};
