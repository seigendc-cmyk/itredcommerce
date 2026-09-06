import { db } from '../../db/connection';

// Fact provider for BI-DEADSTOCK-RESTOCK-001 — queries local SQLite only,
// per DL-062 ("fact providers query local SQLite only, no live Supabase
// round-trip needed to evaluate a rule").
//
// "Last restock request" for a sku is the most recent purchase_memo_items
// row referencing it (any status — a rejected/cancelled request still
// counts as "we already asked," which is the point of this rule). Sales
// since then are summed from completed sales_transactions only.
export function computeSalesSinceLastRequest(sku: string): number {
  const lastRequest = db
    .prepare(
      `SELECT pm.request_date AS request_date
       FROM purchase_memo_items pmi
       JOIN purchase_memos pm ON pm.id = pmi.memo_id
       WHERE pmi.sku = ?
       ORDER BY pm.request_date DESC
       LIMIT 1`
    )
    .get(sku) as { request_date: string } | undefined;

  // No prior request at all — nothing to compare against, so the rule
  // should not fire (there's no "since last request" window yet).
  if (!lastRequest?.request_date) return Number.POSITIVE_INFINITY;

  const row = db
    .prepare(
      `SELECT COALESCE(SUM(sli.quantity), 0) AS total
       FROM sale_line_items sli
       JOIN sales_transactions st ON st.sale_id = sli.sale_id
       WHERE sli.sku = ? AND st.status = 'COMPLETED' AND st.date_time > ?`
    )
    .get(sku, lastRequest.request_date) as { total: number };

  return row.total;
}
