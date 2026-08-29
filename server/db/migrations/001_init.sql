-- iTred Commerce — initial schema
-- Real relational tables for the transactional core; a shared generic
-- JSON-record table (generic_records) for simpler reference/config domains
-- that are display/edit lists rather than heavily-joined business entities.

PRAGMA foreign_keys = ON;

-- --------------------------------------------------------
-- IDENTITY & AUTH
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  role_title TEXT NOT NULL,
  department TEXT,
  pin_hash TEXT NOT NULL,
  avatar_initials TEXT,
  last_login TEXT,
  permissions TEXT NOT NULL DEFAULT '[]',   -- JSON array
  terminal_access TEXT NOT NULL DEFAULT '[]', -- JSON array
  is_active INTEGER NOT NULL DEFAULT 1
);

-- --------------------------------------------------------
-- LOCATIONS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  code TEXT, name TEXT NOT NULL, address TEXT, manager_name TEXT,
  contact_phone TEXT, email TEXT, total_capacity_sq_m REAL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', is_default INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  code TEXT, name TEXT NOT NULL, address TEXT, city TEXT, manager_name TEXT,
  contact_phone TEXT, email TEXT, operating_hours TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE', is_default INTEGER NOT NULL DEFAULT 0,
  default_warehouse_id TEXT, default_warehouse_name TEXT, notes TEXT
);

CREATE TABLE IF NOT EXISTS terminals (
  id TEXT PRIMARY KEY,
  code TEXT, name TEXT NOT NULL, branch_id TEXT, branch_name TEXT,
  workstation_type TEXT NOT NULL DEFAULT 'COUNTER_POS',
  current_cashier_staff_id TEXT, current_cashier_staff_name TEXT,
  cash_drawer_port TEXT, receipt_printer TEXT,
  status TEXT NOT NULL DEFAULT 'OFFLINE', is_default INTEGER NOT NULL DEFAULT 0,
  last_active TEXT, ip_address TEXT,
  daily_sales_total REAL NOT NULL DEFAULT 0, daily_transactions_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS connected_shops (
  id TEXT PRIMARY KEY,
  location_id TEXT, location_type TEXT, name TEXT NOT NULL, city TEXT,
  is_connected_online INTEGER NOT NULL DEFAULT 0, sync_status TEXT NOT NULL DEFAULT 'OFFLINE',
  last_ping TEXT, allow_peer_stock_viewing INTEGER NOT NULL DEFAULT 0, ip_or_domain TEXT
);

-- --------------------------------------------------------
-- PARTIES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL, contact_person TEXT, email TEXT, phone TEXT, address TEXT,
  payment_terms TEXT, tax_number TEXT, current_balance REAL NOT NULL DEFAULT 0,
  due_amount REAL NOT NULL DEFAULT 0, overdue_amount REAL NOT NULL DEFAULT 0,
  last_purchase_date TEXT, last_purchase_amount REAL, last_purchase_ref TEXT,
  last_payment_date TEXT, last_payment_amount REAL, last_payment_ref TEXT,
  bank_account_details TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  account_number TEXT UNIQUE, name TEXT NOT NULL, company_name TEXT, phone TEXT,
  email TEXT, address TEXT, tax_number TEXT, tax_exempt INTEGER NOT NULL DEFAULT 0,
  tax_exemption_cert_number TEXT, status TEXT NOT NULL DEFAULT 'APPROVED',
  credit_status TEXT, debtor_status TEXT, is_credit_approved INTEGER NOT NULL DEFAULT 0,
  credit_limit REAL NOT NULL DEFAULT 0, current_balance REAL NOT NULL DEFAULT 0,
  available_credit REAL NOT NULL DEFAULT 0, payment_terms TEXT, payment_terms_days INTEGER,
  last_purchase_date TEXT, last_purchase_amount REAL, last_purchase_ref TEXT,
  last_payment_date TEXT, last_payment_amount REAL, last_payment_ref TEXT,
  overdue_amount REAL NOT NULL DEFAULT 0, created_date TEXT, created_by_staff_id TEXT,
  approved_by_manager_id TEXT, credit_approved_date TEXT,
  exceptional_credit_override_notes TEXT, notes TEXT
);

-- --------------------------------------------------------
-- INVENTORY
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_items (
  sku TEXT PRIMARY KEY,
  barcode TEXT, name TEXT, description TEXT, department TEXT, category TEXT,
  unit_of_measure TEXT, stock_on_hand REAL NOT NULL DEFAULT 0, reorder_level REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0, retail_price REAL NOT NULL DEFAULT 0,
  preferred_supplier TEXT, is_active INTEGER NOT NULL DEFAULT 1,
  image_url TEXT, tax_rate REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'In Stock',
  location TEXT, part_number TEXT, oem_number TEXT,
  custom_fields TEXT NOT NULL DEFAULT '{}', last_updated TEXT
);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory_items(barcode);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL, movement_type TEXT NOT NULL, sku TEXT NOT NULL, item_name TEXT,
  quantity REAL NOT NULL, unit_cost REAL NOT NULL DEFAULT 0, total_value REAL NOT NULL DEFAULT 0,
  source_location_id TEXT, source_location_name TEXT,
  destination_location_id TEXT, destination_location_name TEXT,
  reference_document TEXT, staff_id TEXT, staff_name TEXT,
  shift_id TEXT, terminal_id TEXT, reason_code TEXT, notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_movements_sku ON inventory_movements(sku);
CREATE INDEX IF NOT EXISTS idx_movements_timestamp ON inventory_movements(timestamp);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id TEXT PRIMARY KEY,
  adjustment_number TEXT, location_id TEXT, location_type TEXT, location_name TEXT,
  sku TEXT, item_name TEXT, adjustment_type TEXT, quantity_delta REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0, total_delta_value REAL NOT NULL DEFAULT 0,
  staff_name TEXT, date TEXT, reason TEXT
);

CREATE TABLE IF NOT EXISTS stocktakes (
  id TEXT PRIMARY KEY,
  batch_no TEXT, location_id TEXT, location_type TEXT, location_name TEXT, date TEXT,
  auditor_staff_name TEXT, status TEXT NOT NULL DEFAULT 'DRAFT', items_count INTEGER NOT NULL DEFAULT 0,
  counted_qty REAL NOT NULL DEFAULT 0, book_qty REAL NOT NULL DEFAULT 0,
  variance_units REAL NOT NULL DEFAULT 0, valuation_delta REAL NOT NULL DEFAULT 0, notes TEXT
);

CREATE TABLE IF NOT EXISTS stocktake_sessions (
  id TEXT PRIMARY KEY,
  session_number TEXT, title TEXT, location_id TEXT, location_type TEXT, location_name TEXT,
  department_filter TEXT, is_blind_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by_staff_id TEXT, created_by_staff_name TEXT, created_date_time TEXT, completed_date_time TEXT,
  total_expected_units REAL NOT NULL DEFAULT 0, total_counted_units REAL NOT NULL DEFAULT 0,
  total_variance_units REAL NOT NULL DEFAULT 0, total_variance_valuation REAL NOT NULL DEFAULT 0,
  approval_required INTEGER NOT NULL DEFAULT 0, approved_by_staff_name TEXT, approved_date_time TEXT,
  approval_notes TEXT, notes TEXT
);

CREATE TABLE IF NOT EXISTS stocktake_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES stocktake_sessions(id) ON DELETE CASCADE,
  sku TEXT NOT NULL, barcode TEXT, name TEXT, category TEXT, bin_location TEXT,
  unit_cost REAL NOT NULL DEFAULT 0, retail_price REAL NOT NULL DEFAULT 0,
  book_qty REAL NOT NULL DEFAULT 0, counted_qty REAL, variance_qty REAL NOT NULL DEFAULT 0,
  variance_valuation REAL NOT NULL DEFAULT 0, reason_code TEXT, notes TEXT,
  last_counted_timestamp TEXT, counted_by_staff_name TEXT, exception_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_stocktake_lines_session ON stocktake_lines(session_id);

CREATE TABLE IF NOT EXISTS reorder_recommendations (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL, item_name TEXT, department TEXT, location_id TEXT, location_name TEXT,
  stock_on_hand REAL NOT NULL DEFAULT 0, available_stock REAL NOT NULL DEFAULT 0,
  reorder_level REAL NOT NULL DEFAULT 0, target_stock REAL NOT NULL DEFAULT 0,
  average_daily_sales REAL NOT NULL DEFAULT 0, supplier_lead_time_days INTEGER,
  suggested_reorder_qty REAL NOT NULL DEFAULT 0, preferred_supplier_code TEXT, preferred_supplier_name TEXT,
  last_cost REAL NOT NULL DEFAULT 0, estimated_cost_total REAL NOT NULL DEFAULT 0, reason TEXT,
  status TEXT NOT NULL DEFAULT 'NEW', rule_version INTEGER NOT NULL DEFAULT 1, created_at TEXT,
  reviewed_by_staff_name TEXT, reviewed_at TEXT, decision_notes TEXT,
  converted_document_type TEXT, converted_document_number TEXT
);

-- --------------------------------------------------------
-- SALES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_transactions (
  sale_id TEXT PRIMARY KEY,
  sale_number TEXT NOT NULL, date_time TEXT NOT NULL,
  customer_id TEXT, customer_name TEXT,
  cashier_id TEXT, cashier_name TEXT,
  subtotal REAL NOT NULL DEFAULT 0, tax_total REAL NOT NULL DEFAULT 0,
  discount_total REAL NOT NULL DEFAULT 0, grand_total REAL NOT NULL DEFAULT 0,
  change_given REAL NOT NULL DEFAULT 0, transaction_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED', terminal_id TEXT, shift_id TEXT,
  branch_id TEXT, branch_name TEXT, idempotency_key TEXT UNIQUE,
  total_cost_basis REAL, gross_margin REAL, notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_sales_datetime ON sales_transactions(date_time);
CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales_transactions(customer_id);

CREATE TABLE IF NOT EXISTS sale_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id TEXT NOT NULL REFERENCES sales_transactions(sale_id) ON DELETE CASCADE,
  sku TEXT, item_name TEXT, part_number TEXT, oem_number TEXT,
  quantity REAL NOT NULL, unit_price REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0, discount_amount REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0, tax_amount REAL NOT NULL DEFAULT 0,
  unit_cost_basis REAL NOT NULL DEFAULT 0, cost_total REAL NOT NULL DEFAULT 0,
  net_subtotal REAL NOT NULL DEFAULT 0, line_total REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sale_lines_sale ON sale_line_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_lines_sku ON sale_line_items(sku);

CREATE TABLE IF NOT EXISTS sale_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id TEXT NOT NULL REFERENCES sales_transactions(sale_id) ON DELETE CASCADE,
  method TEXT NOT NULL, amount REAL NOT NULL, reference TEXT
);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);

CREATE TABLE IF NOT EXISTS held_sales (
  id TEXT PRIMARY KEY,
  sale_number TEXT, customer_id TEXT, customer_name TEXT, cashier_id TEXT, cashier_name TEXT,
  subtotal REAL NOT NULL DEFAULT 0, grand_total REAL NOT NULL DEFAULT 0, date_time TEXT,
  expected_settlement_time TEXT, status TEXT NOT NULL DEFAULT 'OUTSTANDING', notes TEXT,
  settled_date_time TEXT, converted_by_staff TEXT
);
CREATE TABLE IF NOT EXISTS held_sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  held_sale_id TEXT NOT NULL REFERENCES held_sales(id) ON DELETE CASCADE,
  sku TEXT, item_name TEXT, quantity REAL NOT NULL, unit_price REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0, tax_amount REAL NOT NULL DEFAULT 0, line_total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS held_receipts (
  id TEXT PRIMARY KEY,
  cashier_id TEXT, cashier_name TEXT, customer_id TEXT, customer_name TEXT,
  parked_at TEXT, note TEXT, total_amount REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS held_receipt_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  held_receipt_id TEXT NOT NULL REFERENCES held_receipts(id) ON DELETE CASCADE,
  sku TEXT, item_name TEXT, quantity REAL NOT NULL, unit_price REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0, tax_amount REAL NOT NULL DEFAULT 0, line_total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layaway_orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT, customer_name TEXT, cashier_id TEXT, cashier_name TEXT,
  total_amount REAL NOT NULL DEFAULT 0, amount_paid REAL NOT NULL DEFAULT 0,
  balance_remaining REAL NOT NULL DEFAULT 0, next_expected_payment_date TEXT,
  deposit_percent REAL NOT NULL DEFAULT 0, created_date TEXT, expiry_date TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE', converted_sale_number TEXT
);
CREATE TABLE IF NOT EXISTS layaway_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  layaway_id TEXT NOT NULL REFERENCES layaway_orders(id) ON DELETE CASCADE,
  sku TEXT, item_name TEXT, quantity REAL NOT NULL, unit_price REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0, tax_amount REAL NOT NULL DEFAULT 0, line_total REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS layaway_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  layaway_id TEXT NOT NULL REFERENCES layaway_orders(id) ON DELETE CASCADE,
  date TEXT, amount REAL NOT NULL, method TEXT, cashier_name TEXT, receipt_no TEXT
);

CREATE TABLE IF NOT EXISTS credit_notes (
  id TEXT PRIMARY KEY,
  original_sale_number TEXT, customer_id TEXT, customer_name TEXT,
  cashier_id TEXT, cashier_name TEXT, date_time TEXT,
  total_refund_amount REAL NOT NULL DEFAULT 0, refund_method TEXT,
  reason_category TEXT, status TEXT NOT NULL DEFAULT 'ISSUED'
);
CREATE TABLE IF NOT EXISTS credit_note_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_note_id TEXT NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  sku TEXT, item_name TEXT, return_qty REAL NOT NULL DEFAULT 0, unit_price REAL NOT NULL DEFAULT 0,
  reason TEXT, restock INTEGER NOT NULL DEFAULT 1
);

-- --------------------------------------------------------
-- SHIFTS & EOD
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  shift_number TEXT, terminal_id TEXT, terminal_name TEXT, branch_id TEXT, branch_name TEXT,
  cashier_staff_id TEXT, cashier_staff_name TEXT, opened_date_time TEXT, opening_date TEXT,
  opening_float REAL NOT NULL DEFAULT 0, opening_notes TEXT,
  closed_date_time TEXT, closing_float REAL, status TEXT NOT NULL DEFAULT 'OPEN',
  expected_cash REAL NOT NULL DEFAULT 0, counted_cash REAL, cash_variance REAL,
  cash_variance_tolerance REAL, cash_up_mode TEXT, close_policy TEXT,
  total_sales_count INTEGER NOT NULL DEFAULT 0, gross_sales REAL NOT NULL DEFAULT 0,
  total_cash_sales REAL NOT NULL DEFAULT 0, total_mobile_money_sales REAL NOT NULL DEFAULT 0,
  total_card_sales REAL NOT NULL DEFAULT 0, total_credit_sales REAL NOT NULL DEFAULT 0,
  total_refunds REAL NOT NULL DEFAULT 0, total_payouts REAL NOT NULL DEFAULT 0,
  total_held_sales REAL NOT NULL DEFAULT 0, total_layaway_receipts REAL NOT NULL DEFAULT 0,
  tender_reconciliation TEXT, cash_movements TEXT, reconciliation_snapshot TEXT,
  closure_reason_code TEXT, cash_discrepancy_severity TEXT, closing_notes TEXT,
  approved_by_staff_name TEXT, approved_date_time TEXT
);
CREATE INDEX IF NOT EXISTS idx_shifts_terminal ON shifts(terminal_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

CREATE TABLE IF NOT EXISTS eod_reports (
  id TEXT PRIMARY KEY,
  report_number TEXT, date TEXT, branch_id TEXT, branch_name TEXT, terminal_id TEXT, terminal_name TEXT,
  generated_by_staff_id TEXT, generated_by_staff_name TEXT, status TEXT NOT NULL DEFAULT 'DRAFT',
  total_sales REAL NOT NULL DEFAULT 0, total_cash_expected REAL NOT NULL DEFAULT 0,
  total_cash_counted REAL NOT NULL DEFAULT 0, total_variance REAL NOT NULL DEFAULT 0,
  unresolved_held_sales_count INTEGER NOT NULL DEFAULT 0, unresolved_held_sales_value REAL NOT NULL DEFAULT 0,
  unapproved_refunds_count INTEGER NOT NULL DEFAULT 0, unapproved_refunds_value REAL NOT NULL DEFAULT 0,
  open_tills_count INTEGER NOT NULL DEFAULT 0, pending_stock_adjustments_count INTEGER NOT NULL DEFAULT 0,
  manager_approved_by TEXT, manager_approval_date TEXT, manager_notes TEXT, created_date_time TEXT
);
CREATE TABLE IF NOT EXISTS eod_reconciliation_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eod_report_id TEXT NOT NULL REFERENCES eod_reports(id) ON DELETE CASCADE,
  category TEXT, label TEXT, expected_amount REAL NOT NULL DEFAULT 0,
  counted_amount REAL NOT NULL DEFAULT 0, variance REAL NOT NULL DEFAULT 0, notes TEXT
);

-- --------------------------------------------------------
-- PURCHASING & LOGISTICS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_memos (
  id TEXT PRIMARY KEY,
  memo_number TEXT, supplier_name TEXT, supplier_code TEXT, request_date TEXT, required_date TEXT,
  requested_by_staff_id TEXT, requested_by_staff_name TEXT, department TEXT,
  destination_warehouse_id TEXT, destination_warehouse_name TEXT, priority TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'Draft', notes TEXT, converted_po_number TEXT,
  approved_by_staff_name TEXT, approval_date TEXT
);
CREATE TABLE IF NOT EXISTS purchase_memo_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memo_id TEXT NOT NULL REFERENCES purchase_memos(id) ON DELETE CASCADE,
  sku TEXT, description TEXT, requested_qty REAL NOT NULL DEFAULT 0, estimated_unit_cost REAL, notes TEXT
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  po_number TEXT PRIMARY KEY,
  supplier_name TEXT, supplier_code TEXT, date_created TEXT, delivery_due_date TEXT,
  destination_warehouse_id TEXT, destination_warehouse_name TEXT, total_items INTEGER NOT NULL DEFAULT 0,
  subtotal REAL, tax_rate REAL, tax_amount REAL, total_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD', status TEXT NOT NULL DEFAULT 'Open',
  payment_terms TEXT, authorized_by TEXT, notes TEXT, origin_memo_number TEXT
);
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT NOT NULL REFERENCES purchase_orders(po_number) ON DELETE CASCADE,
  sku TEXT, description TEXT, ordered_qty REAL NOT NULL DEFAULT 0, received_qty REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0, total_cost REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS goods_receipt_notes (
  id TEXT PRIMARY KEY,
  grn_number TEXT, po_number TEXT, supplier_code TEXT, supplier_name TEXT,
  destination_warehouse_id TEXT, destination_warehouse_name TEXT, received_date TEXT,
  received_by_staff_name TEXT, delivery_note_number TEXT,
  total_units_received REAL NOT NULL DEFAULT 0, total_valuation REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACCEPTED', notes TEXT
);
CREATE TABLE IF NOT EXISTS goods_receipt_note_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grn_id TEXT NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
  sku TEXT, description TEXT, ordered_qty REAL NOT NULL DEFAULT 0, received_qty REAL NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0, total_cost REAL NOT NULL DEFAULT 0,
  batch_number TEXT, expiry_date TEXT, condition TEXT NOT NULL DEFAULT 'GOOD'
);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id TEXT PRIMARY KEY,
  transfer_number TEXT, flow_type TEXT,
  origin_location_id TEXT, origin_location_type TEXT, origin_location_name TEXT,
  destination_location_id TEXT, destination_location_type TEXT, destination_location_name TEXT,
  request_date TEXT, status TEXT NOT NULL DEFAULT 'Draft', requested_by_staff_name TEXT,
  approved_by_staff_name TEXT, approved_date TEXT, dispatched_by_staff_name TEXT, dispatched_date TEXT,
  carrier_or_vehicle TEXT, dispatch_notes TEXT, received_by_staff_name TEXT, received_date TEXT,
  receiving_notes TEXT, rejection_reason TEXT, notes TEXT,
  has_discrepancy INTEGER NOT NULL DEFAULT 0, discrepancy_reason TEXT, discrepancy_notes TEXT
);
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_id TEXT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  sku TEXT, description TEXT, requested_qty REAL NOT NULL DEFAULT 0, dispatched_qty REAL NOT NULL DEFAULT 0,
  received_qty REAL NOT NULL DEFAULT 0, variance_qty REAL, discrepancy_reason TEXT,
  discrepancy_notes TEXT, unit_cost REAL NOT NULL DEFAULT 0
);

-- --------------------------------------------------------
-- FINANCIAL: DEBTORS, CREDITORS, CASH/BANK, RESERVES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS debtor_transactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT, customer_name TEXT, account_number TEXT, date_time TEXT,
  transaction_type TEXT, reference_number TEXT, description TEXT,
  debit REAL NOT NULL DEFAULT 0, credit REAL NOT NULL DEFAULT 0, running_balance REAL NOT NULL DEFAULT 0,
  due_date TEXT, status TEXT NOT NULL DEFAULT 'UNPAID', allocated_amount REAL, payment_method TEXT,
  notes TEXT, cashier_or_staff_name TEXT
);
CREATE INDEX IF NOT EXISTS idx_debtor_tx_customer ON debtor_transactions(customer_id);

CREATE TABLE IF NOT EXISTS creditor_transactions (
  id TEXT PRIMARY KEY,
  supplier_code TEXT, supplier_name TEXT, date_time TEXT, transaction_type TEXT,
  reference_number TEXT, description TEXT, invoice_amount REAL NOT NULL DEFAULT 0,
  payment_amount REAL NOT NULL DEFAULT 0, running_balance REAL NOT NULL DEFAULT 0,
  due_date TEXT, status TEXT NOT NULL DEFAULT 'PENDING', payment_method TEXT,
  authorized_by_staff_name TEXT, notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_creditor_tx_supplier ON creditor_transactions(supplier_code);

CREATE TABLE IF NOT EXISTS cash_bank_accounts (
  id TEXT PRIMARY KEY,
  code TEXT, name TEXT, account_type TEXT, account_number TEXT, institution_or_provider TEXT,
  branch_id TEXT, branch_name TEXT, currency TEXT NOT NULL DEFAULT 'USD',
  current_balance REAL NOT NULL DEFAULT 0, opening_balance REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE', is_default INTEGER NOT NULL DEFAULT 0,
  requires_dual_approval_for_transfer INTEGER NOT NULL DEFAULT 0, max_daily_outflow_limit REAL,
  last_reconciled_date TEXT, notes TEXT
);

CREATE TABLE IF NOT EXISTS cash_bank_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT, account_name TEXT, date_time TEXT, movement_type TEXT,
  amount REAL NOT NULL DEFAULT 0, fee_amount REAL, balance_after REAL NOT NULL DEFAULT 0,
  reference_number TEXT, counter_account_id TEXT, counter_account_name TEXT, description TEXT,
  performed_by_staff_id TEXT, performed_by_staff_name TEXT, approved_by_staff_name TEXT,
  status TEXT NOT NULL DEFAULT 'POSTED', receipt_or_slip_number TEXT, notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_cash_bank_tx_account ON cash_bank_transactions(account_id);

CREATE TABLE IF NOT EXISTS cash_movements (
  id TEXT PRIMARY KEY,
  movement_number TEXT, category TEXT, source_account_id TEXT, source_account_name TEXT,
  destination_account_id TEXT, destination_account_name TEXT, amount REAL NOT NULL DEFAULT 0,
  reason_category TEXT, description TEXT, receipt_slip_number TEXT, bag_seal_number TEXT,
  denomination_breakdown TEXT, requested_by_staff_id TEXT, requested_by_staff_name TEXT,
  is_sensitive INTEGER NOT NULL DEFAULT 0, requires_approval INTEGER NOT NULL DEFAULT 0,
  approval_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED', approved_by_staff_name TEXT,
  approved_date_time TEXT, date_time TEXT
);

CREATE TABLE IF NOT EXISTS business_reserves (
  id TEXT PRIMARY KEY,
  code TEXT, name TEXT, category TEXT, target_amount REAL NOT NULL DEFAULT 0,
  current_funded_balance REAL NOT NULL DEFAULT 0, allocation_rule_percent REAL NOT NULL DEFAULT 0,
  linked_bank_account_id TEXT, linked_bank_account_name TEXT, description TEXT,
  priority TEXT NOT NULL DEFAULT 'MEDIUM', status TEXT NOT NULL DEFAULT 'ACTIVE',
  last_contribution_date TEXT, last_drawdown_date TEXT
);

CREATE TABLE IF NOT EXISTS reserve_transfers (
  id TEXT PRIMARY KEY,
  reserve_id TEXT, reserve_name TEXT, date_time TEXT, type TEXT, amount REAL NOT NULL DEFAULT 0,
  from_account_name TEXT, to_account_name TEXT, reference_number TEXT,
  authorized_by_staff_name TEXT, notes TEXT
);

-- --------------------------------------------------------
-- TAX / FISCAL
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  tax_system_name TEXT, tax_registration_number TEXT, fiscal_device_serial_number TEXT,
  tax_invoice_header_disclaimer TEXT, tax_invoice_footer_disclaimer TEXT,
  tax_inclusive_pricing INTEGER NOT NULL DEFAULT 0, currency_symbol TEXT NOT NULL DEFAULT '$'
);
CREATE TABLE IF NOT EXISTS tax_categories (
  id TEXT PRIMARY KEY,
  code TEXT, name TEXT, standard_rate REAL NOT NULL DEFAULT 0, is_compound INTEGER NOT NULL DEFAULT 0,
  is_exempt INTEGER NOT NULL DEFAULT 0, is_zero_rated INTEGER NOT NULL DEFAULT 0,
  description TEXT, active INTEGER NOT NULL DEFAULT 1, fiscal_code TEXT
);
CREATE TABLE IF NOT EXISTS tax_classifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_or_category TEXT, tax_category_id TEXT, tax_category_name TEXT,
  tax_rate REAL NOT NULL DEFAULT 0, item_count INTEGER NOT NULL DEFAULT 0
);

-- --------------------------------------------------------
-- GOVERNANCE: APPROVALS, EXCEPTIONS, ACTIVITY EVENTS, BACKUPS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  request_number TEXT, type TEXT, title TEXT, description TEXT, amount REAL,
  reference_id TEXT, reference_type TEXT, location_name TEXT,
  requested_by_staff_id TEXT, requested_by_staff_name TEXT, requested_by_role TEXT,
  requested_date_time TEXT, reason TEXT, priority TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'PENDING', decided_by_staff_id TEXT, decided_by_staff_name TEXT,
  decided_by_role TEXT, decision_date_time TEXT, decision_notes TEXT, meta TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS operational_exceptions (
  id TEXT PRIMARY KEY,
  exception_number TEXT, title TEXT, category TEXT, date_time TEXT,
  branch_id TEXT, branch_name TEXT, terminal_id TEXT, terminal_name TEXT,
  staff_id TEXT, staff_name TEXT, related_transaction_ref TEXT, related_event_id TEXT,
  severity TEXT NOT NULL DEFAULT 'MEDIUM', status TEXT NOT NULL DEFAULT 'OPEN',
  variance_amount REAL, variance_units REAL, assigned_or_reviewed_by TEXT, reviewed_date_time TEXT,
  resolution TEXT, details TEXT, opened_at TEXT, resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON operational_exceptions(status);

CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL, timestamp TEXT NOT NULL,
  description TEXT, staff_id TEXT, staff_name TEXT,
  branch_id TEXT, branch_name TEXT, terminal_id TEXT,
  reference_document TEXT, amount REAL, quantity REAL, metadata TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_staff ON activity_events(staff_id);

CREATE TABLE IF NOT EXISTS backups (
  backup_id TEXT PRIMARY KEY,
  type TEXT NOT NULL, created_at TEXT NOT NULL, application_version TEXT, schema_version INTEGER,
  file_path TEXT, file_size INTEGER, verification_status TEXT NOT NULL DEFAULT 'PENDING',
  checksum TEXT, tenant_id TEXT, tables_count INTEGER, records_count INTEGER,
  wal_checkpoint_completed INTEGER NOT NULL DEFAULT 0, failure_reason TEXT, notes TEXT,
  initiated_by_staff_id TEXT, initiated_by_staff_name TEXT
);

CREATE TABLE IF NOT EXISTS bi_alerts (
  id TEXT PRIMARY KEY,
  rule_type TEXT, category TEXT, title TEXT, recommendation TEXT, explanation TEXT,
  related_record TEXT NOT NULL DEFAULT '{}', priority TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'NEW', date_time TEXT, impact_metric TEXT,
  suggested_action_label TEXT, user_response TEXT, rule_trigger_criteria TEXT
);

-- --------------------------------------------------------
-- SESSIONS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  session_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- --------------------------------------------------------
-- GENERIC REFERENCE/CONFIG DOMAINS
-- (simple catalogs, singleton configs, device/payment lists — stored
--  as JSON records keyed by domain, served via a generic CRUD router)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS generic_records (
  domain TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (domain, id)
);
CREATE INDEX IF NOT EXISTS idx_generic_domain ON generic_records(domain);
