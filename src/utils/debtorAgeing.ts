// DL-069/070/084 (Prompt 15): real ageing buckets computed from each
// customer's open (debit > 0, unpaid/partial) debtor_transactions rows,
// bucketed by how far past due_date they are against the caller-supplied
// "now" — replaces DebtorsView's previous fabricated fixed 60/30/10 split
// of customer.overdueAmount. Pulled out as a pure function (rather than left
// inline in the component) so it's independently testable, matching this
// codebase's shiftReconciliation.ts precedent.

import type { Customer, DebtorTransaction } from '../types';

export interface DebtorAgingRow {
  customer: Customer;
  current0To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  total: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeDebtorAgingBuckets(
  customers: Customer[],
  transactions: DebtorTransaction[],
  now: Date = new Date()
): DebtorAgingRow[] {
  const nowMs = now.getTime();
  const byCustomer = new Map<string, DebtorAgingRow>();

  for (const tx of transactions) {
    if (!(tx.debit > 0 && tx.runningBalance > 0.0001)) continue;
    const customer = customers.find((c) => c.id === tx.customerId);
    if (!customer) continue;

    let entry = byCustomer.get(customer.id);
    if (!entry) {
      entry = { customer, current0To30: 0, days31To60: 0, days61To90: 0, days90Plus: 0, total: 0 };
      byCustomer.set(customer.id, entry);
    }

    const dueMs = tx.dueDate ? new Date(tx.dueDate).getTime() : nowMs;
    const daysPastDue = Math.floor((nowMs - dueMs) / DAY_MS);
    if (daysPastDue <= 30) entry.current0To30 += tx.runningBalance;
    else if (daysPastDue <= 60) entry.days31To60 += tx.runningBalance;
    else if (daysPastDue <= 90) entry.days61To90 += tx.runningBalance;
    else entry.days90Plus += tx.runningBalance;
    entry.total += tx.runningBalance;
  }

  return Array.from(byCustomer.values());
}
