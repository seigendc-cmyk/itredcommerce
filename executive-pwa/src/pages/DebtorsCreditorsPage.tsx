import React, { useEffect, useState } from 'react';
import { PageShell } from '../components/PageShell';
import { DataTable, type Column } from '@shared/components/ui/DataTable';
import { fetchDebtorAging, fetchCreditorAging, type DebtorAgingRow, type CreditorAgingRow } from '../lib/rollups';

export interface DebtorsCreditorsPageProps {
  onBack: () => void;
}

export const DebtorsCreditorsPage: React.FC<DebtorsCreditorsPageProps> = ({ onBack }) => {
  const [tab, setTab] = useState<'DEBTORS' | 'CREDITORS'>('DEBTORS');
  const [debtors, setDebtors] = useState<DebtorAgingRow[]>([]);
  const [creditors, setCreditors] = useState<CreditorAgingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchDebtorAging(), fetchCreditorAging()])
      .then(([d, c]) => {
        setDebtors(d);
        setCreditors(c);
      })
      .catch((err) => setError(err.message || 'Failed to load ageing data'))
      .finally(() => setIsLoading(false));
  }, []);

  const money = (v: number | null) => `$${Number(v || 0).toLocaleString()}`;

  const debtorColumns: Column<DebtorAgingRow>[] = [
    { key: 'customer_name', header: 'Customer' },
    { key: 'current_0_to_30', header: '0-30 Days', align: 'right', isMono: true, render: (r) => money(r.current_0_to_30) },
    { key: 'days_31_to_60', header: '31-60 Days', align: 'right', isMono: true, render: (r) => money(r.days_31_to_60) },
    { key: 'days_61_to_90', header: '61-90 Days', align: 'right', isMono: true, render: (r) => money(r.days_61_to_90) },
    { key: 'days_90_plus', header: '90+ Days', align: 'right', isMono: true, render: (r) => <span className="text-rose-500 font-bold">{money(r.days_90_plus)}</span> },
    { key: 'total_outstanding', header: 'Total', align: 'right', isMono: true, render: (r) => money(r.total_outstanding) },
  ];

  const creditorColumns: Column<CreditorAgingRow>[] = [
    { key: 'supplier_name', header: 'Supplier' },
    { key: 'current_0_to_30', header: '0-30 Days', align: 'right', isMono: true, render: (r) => money(r.current_0_to_30) },
    { key: 'days_31_to_60', header: '31-60 Days', align: 'right', isMono: true, render: (r) => money(r.days_31_to_60) },
    { key: 'days_61_to_90', header: '61-90 Days', align: 'right', isMono: true, render: (r) => money(r.days_61_to_90) },
    { key: 'days_90_plus', header: '90+ Days', align: 'right', isMono: true, render: (r) => <span className="text-rose-500 font-bold">{money(r.days_90_plus)}</span> },
    { key: 'total_outstanding', header: 'Total', align: 'right', isMono: true, render: (r) => money(r.total_outstanding) },
  ];

  const debtorTotal = debtors.reduce((s, r) => s + Number(r.total_outstanding), 0);
  const creditorTotal = creditors.reduce((s, r) => s + Number(r.total_outstanding), 0);

  return (
    <PageShell title="Debtors & Creditors Ageing" onBack={onBack}>
      <div className="flex bg-slate-900 border border-slate-700 p-0.5 mb-4 w-fit">
        <button
          type="button"
          onClick={() => setTab('DEBTORS')}
          className={`px-3 py-1.5 text-xs font-semibold uppercase ${tab === 'DEBTORS' ? 'bg-[#FF6B00] text-white' : 'text-slate-400 hover:text-slate-100'}`}
        >
          Debtors (${debtorTotal.toLocaleString()})
        </button>
        <button
          type="button"
          onClick={() => setTab('CREDITORS')}
          className={`px-3 py-1.5 text-xs font-semibold uppercase ${tab === 'CREDITORS' ? 'bg-[#FF6B00] text-white' : 'text-slate-400 hover:text-slate-100'}`}
        >
          Creditors (${creditorTotal.toLocaleString()})
        </button>
      </div>

      {error && <div className="text-xs text-rose-400 mb-3">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-slate-500">Loading…</div>
      ) : tab === 'DEBTORS' ? (
        <DataTable columns={debtorColumns} data={debtors} keyField="customer_id" pageSize={20} searchable />
      ) : (
        <DataTable columns={creditorColumns} data={creditors} keyField="supplier_code" pageSize={20} searchable />
      )}
    </PageShell>
  );
};
