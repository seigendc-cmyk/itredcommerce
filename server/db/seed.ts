import bcrypt from 'bcryptjs';
import { db, withTransaction } from './connection';
import { generateId } from '../lib/ids';
import * as mock from '../../src/data/mockData';
import { INITIAL_BI_ALERTS } from '../../src/data/mockBiData';

const j = (v: unknown) => JSON.stringify(v ?? null);
const n = (v: unknown, fallback: number = 0) => (typeof v === 'number' ? v : fallback);
const s = (v: unknown, fallback: string | null = null) => (v === undefined ? fallback : (v as any));
const bool = (v: unknown) => (v ? 1 : 0);

function insertGeneric(domain: string, id: string, data: unknown) {
  db.prepare('INSERT INTO generic_records (domain, id, data) VALUES (?, ?, ?)').run(
    domain,
    id,
    JSON.stringify({ ...(data as object), id })
  );
}

function seedStaff() {
  const insert = db.prepare(`
    INSERT INTO staff (id, code, name, role, role_title, department, access_role, pin_hash, avatar_initials, last_login, permissions, terminal_access, is_active)
    VALUES (@id, @code, @name, @role, @role_title, @department, @access_role, @pin_hash, @avatar_initials, @last_login, @permissions, @terminal_access, 1)
  `);
  for (const staff of mock.INITIAL_STAFF_MEMBERS) {
    const pinHash = bcrypt.hashSync(staff.accessCode, 10);
    insert.run({
      id: staff.id,
      code: staff.code,
      name: staff.name,
      role: staff.role,
      role_title: staff.roleTitle,
      department: s(staff.department),
      access_role: s(staff.accessRole, 'TILL_OPERATOR'),
      pin_hash: pinHash,
      avatar_initials: s(staff.avatarInitials),
      last_login: s(staff.lastLogin),
      permissions: j(staff.permissions || []),
      terminal_access: j(staff.terminalAccess || []),
    });
  }
}

function seedLocations() {
  const insertWh = db.prepare(`
    INSERT INTO warehouses (id, code, name, address, manager_name, contact_phone, email, total_capacity_sq_m, status, is_default, notes)
    VALUES (@id, @code, @name, @address, @manager_name, @contact_phone, @email, @total_capacity_sq_m, @status, @is_default, @notes)
  `);
  for (const w of mock.INITIAL_WAREHOUSES) {
    insertWh.run({
      id: w.id, code: s(w.code), name: w.name, address: s(w.address), manager_name: s(w.managerName),
      contact_phone: s(w.contactPhone), email: s(w.email), total_capacity_sq_m: n(w.totalCapacitySqM),
      status: s(w.status, 'ACTIVE'), is_default: bool(w.isDefault), notes: s(w.notes),
    });
  }

  const insertBr = db.prepare(`
    INSERT INTO branches (id, code, name, address, city, manager_name, contact_phone, email, operating_hours, status, is_default, default_warehouse_id, default_warehouse_name, notes)
    VALUES (@id, @code, @name, @address, @city, @manager_name, @contact_phone, @email, @operating_hours, @status, @is_default, @default_warehouse_id, @default_warehouse_name, @notes)
  `);
  for (const b of mock.INITIAL_BRANCHES) {
    insertBr.run({
      id: b.id, code: s(b.code), name: b.name, address: s(b.address), city: s(b.city),
      manager_name: s(b.managerName), contact_phone: s(b.contactPhone), email: s(b.email),
      operating_hours: s(b.operatingHours), status: s(b.status, 'ACTIVE'), is_default: bool(b.isDefault),
      default_warehouse_id: s(b.defaultWarehouseId), default_warehouse_name: s(b.defaultWarehouseName), notes: s(b.notes),
    });
  }

  const insertTerm = db.prepare(`
    INSERT INTO terminals (id, code, name, branch_id, branch_name, workstation_type, current_cashier_staff_id, current_cashier_staff_name, cash_drawer_port, receipt_printer, status, is_default, last_active, ip_address, daily_sales_total, daily_transactions_count)
    VALUES (@id, @code, @name, @branch_id, @branch_name, @workstation_type, @current_cashier_staff_id, @current_cashier_staff_name, @cash_drawer_port, @receipt_printer, @status, @is_default, @last_active, @ip_address, @daily_sales_total, @daily_transactions_count)
  `);
  for (const t of mock.INITIAL_TERMINALS) {
    insertTerm.run({
      id: t.id, code: s(t.code), name: t.name, branch_id: s(t.branchId), branch_name: s(t.branchName),
      workstation_type: s(t.workstationType, 'COUNTER_POS'), current_cashier_staff_id: s((t as any).currentCashierStaffId),
      current_cashier_staff_name: s(t.activeCashierName || (t as any).currentCashierStaffName), cash_drawer_port: s(t.cashDrawerPort),
      receipt_printer: s(t.receiptPrinter), status: s(t.status, 'OFFLINE'), is_default: bool(t.isDefault),
      last_active: s(t.lastActive), ip_address: s(t.ipAddress), daily_sales_total: n(t.dailySalesTotal),
      daily_transactions_count: n(t.dailyTransactionsCount),
    });
  }

  const insertShop = db.prepare(`
    INSERT INTO connected_shops (id, location_id, location_type, name, city, is_connected_online, sync_status, last_ping, allow_peer_stock_viewing, ip_or_domain)
    VALUES (@id, @location_id, @location_type, @name, @city, @is_connected_online, @sync_status, @last_ping, @allow_peer_stock_viewing, @ip_or_domain)
  `);
  for (const c of mock.INITIAL_CONNECTED_SHOPS) {
    insertShop.run({
      id: c.id, location_id: s(c.locationId), location_type: s(c.locationType), name: c.name, city: s(c.city),
      is_connected_online: bool(c.isConnectedOnline), sync_status: s(c.syncStatus, 'OFFLINE'), last_ping: s(c.lastPing),
      allow_peer_stock_viewing: bool(c.allowPeerStockViewing), ip_or_domain: s(c.ipOrDomain),
    });
  }
}

function seedParties() {
  const insertSup = db.prepare(`
    INSERT INTO suppliers (code, name, contact_person, email, phone, address, payment_terms, tax_number, current_balance, due_amount, overdue_amount, last_purchase_date, last_purchase_amount, last_purchase_ref, last_payment_date, last_payment_amount, last_payment_ref, bank_account_details, status)
    VALUES (@code, @name, @contact_person, @email, @phone, @address, @payment_terms, @tax_number, @current_balance, @due_amount, @overdue_amount, @last_purchase_date, @last_purchase_amount, @last_purchase_ref, @last_payment_date, @last_payment_amount, @last_payment_ref, @bank_account_details, @status)
  `);
  for (const sup of mock.INITIAL_SUPPLIERS) {
    insertSup.run({
      code: sup.code, name: sup.name, contact_person: s(sup.contactPerson), email: s(sup.email), phone: s(sup.phone),
      address: s(sup.address), payment_terms: s(sup.paymentTerms), tax_number: s(sup.taxNumber),
      current_balance: n(sup.currentBalance), due_amount: n(sup.dueAmount), overdue_amount: n(sup.overdueAmount),
      last_purchase_date: s(sup.lastPurchaseDate), last_purchase_amount: sup.lastPurchaseAmount ?? null,
      last_purchase_ref: s(sup.lastPurchaseRef), last_payment_date: s(sup.lastPaymentDate),
      last_payment_amount: sup.lastPaymentAmount ?? null, last_payment_ref: s(sup.lastPaymentRef),
      bank_account_details: s(sup.bankAccountDetails), status: s(sup.status, 'ACTIVE'),
    });
  }

  const insertCust = db.prepare(`
    INSERT INTO customers (id, account_number, name, company_name, phone, email, address, tax_number, tax_exempt, tax_exemption_cert_number, status, credit_status, debtor_status, is_credit_approved, credit_limit, current_balance, available_credit, payment_terms, payment_terms_days, last_purchase_date, last_purchase_amount, last_purchase_ref, last_payment_date, last_payment_amount, last_payment_ref, overdue_amount, created_date, created_by_staff_id, approved_by_manager_id, credit_approved_date, exceptional_credit_override_notes, notes)
    VALUES (@id, @account_number, @name, @company_name, @phone, @email, @address, @tax_number, @tax_exempt, @tax_exemption_cert_number, @status, @credit_status, @debtor_status, @is_credit_approved, @credit_limit, @current_balance, @available_credit, @payment_terms, @payment_terms_days, @last_purchase_date, @last_purchase_amount, @last_purchase_ref, @last_payment_date, @last_payment_amount, @last_payment_ref, @overdue_amount, @created_date, @created_by_staff_id, @approved_by_manager_id, @credit_approved_date, @exceptional_credit_override_notes, @notes)
  `);
  for (const c of mock.INITIAL_CUSTOMERS) {
    insertCust.run({
      id: c.id, account_number: s(c.accountNumber), name: c.name, company_name: s(c.companyName), phone: s(c.phone),
      email: s(c.email), address: s(c.address), tax_number: s(c.taxNumber), tax_exempt: bool(c.taxExempt),
      tax_exemption_cert_number: s(c.taxExemptionCertNumber), status: s(c.status, 'APPROVED'), credit_status: s(c.creditStatus),
      debtor_status: s(c.debtorStatus), is_credit_approved: bool(c.isCreditApproved), credit_limit: n(c.creditLimit),
      current_balance: n(c.currentBalance), available_credit: n(c.availableCredit), payment_terms: s(c.paymentTerms),
      payment_terms_days: c.paymentTermsDays ?? null, last_purchase_date: s(c.lastPurchaseDate),
      last_purchase_amount: c.lastPurchaseAmount ?? null, last_purchase_ref: s(c.lastPurchaseRef),
      last_payment_date: s(c.lastPaymentDate), last_payment_amount: c.lastPaymentAmount ?? null,
      last_payment_ref: s(c.lastPaymentRef), overdue_amount: n(c.overdueAmount), created_date: s(c.createdDate),
      created_by_staff_id: s(c.createdByStaffId), approved_by_manager_id: s(c.approvedByManagerId),
      credit_approved_date: s(c.creditApprovedDate), exceptional_credit_override_notes: s(c.exceptionalCreditOverrideNotes),
      notes: s(c.notes),
    });
  }
}

function seedInventory() {
  const insertItem = db.prepare(`
    INSERT INTO inventory_items (sku, barcode, name, description, department, category, unit_of_measure, stock_on_hand, reorder_level, unit_cost, retail_price, preferred_supplier, is_active, image_url, tax_rate, status, location, part_number, oem_number, custom_fields, last_updated)
    VALUES (@sku, @barcode, @name, @description, @department, @category, @unit_of_measure, @stock_on_hand, @reorder_level, @unit_cost, @retail_price, @preferred_supplier, @is_active, @image_url, @tax_rate, @status, @location, @part_number, @oem_number, @custom_fields, @last_updated)
  `);
  for (const it of mock.INITIAL_INVENTORY_ITEMS) {
    insertItem.run({
      sku: it.sku, barcode: s(it.barcode), name: s(it.name || it.description), description: s(it.description),
      department: s(it.department), category: s(it.category), unit_of_measure: s(it.unitOfMeasure),
      stock_on_hand: n(it.stockOnHand), reorder_level: n(it.reorderLevel), unit_cost: n(it.unitCost ?? it.cost),
      retail_price: n(it.retailPrice ?? it.price), preferred_supplier: s(it.preferredSupplier), is_active: bool(it.isActive ?? true),
      image_url: s(it.imageUrl), tax_rate: n(it.taxRate), status: s(it.status, 'In Stock'), location: s(it.location),
      part_number: s(it.partNumber), oem_number: s(it.oemNumber), custom_fields: j(it.customFields || {}),
      last_updated: s(it.lastUpdated),
    });
  }

  const insertMov = db.prepare(`
    INSERT INTO inventory_movements (id, timestamp, movement_type, sku, item_name, quantity, unit_cost, total_value, source_location_id, source_location_name, destination_location_id, destination_location_name, reference_document, staff_id, staff_name, shift_id, terminal_id, reason_code, notes)
    VALUES (@id, @timestamp, @movement_type, @sku, @item_name, @quantity, @unit_cost, @total_value, @source_location_id, @source_location_name, @destination_location_id, @destination_location_name, @reference_document, @staff_id, @staff_name, @shift_id, @terminal_id, @reason_code, @notes)
  `);
  for (const m of mock.INITIAL_INVENTORY_MOVEMENTS) {
    insertMov.run({
      id: m.id || generateId('MOV'), timestamp: s(m.timestamp), movement_type: m.movementType, sku: m.sku,
      item_name: s(m.itemName), quantity: n(m.quantity), unit_cost: n(m.unitCost), total_value: n(m.totalValue),
      source_location_id: s(m.sourceLocationId), source_location_name: s(m.sourceLocationName),
      destination_location_id: s(m.destinationLocationId), destination_location_name: s(m.destinationLocationName),
      reference_document: s(m.referenceDocument), staff_id: s(m.staffId), staff_name: s(m.staffName),
      shift_id: s(m.shiftId), terminal_id: s(m.terminalId), reason_code: s(m.reasonCode), notes: s(m.notes),
    });
  }

  const insertAdj = db.prepare(`
    INSERT INTO stock_adjustments (id, adjustment_number, location_id, location_type, location_name, sku, item_name, adjustment_type, quantity_delta, unit_cost, total_delta_value, staff_name, date, reason)
    VALUES (@id, @adjustment_number, @location_id, @location_type, @location_name, @sku, @item_name, @adjustment_type, @quantity_delta, @unit_cost, @total_delta_value, @staff_name, @date, @reason)
  `);
  for (const a of mock.INITIAL_STOCK_ADJUSTMENTS) {
    insertAdj.run({
      id: a.id, adjustment_number: s(a.adjustmentNumber), location_id: s(a.locationId), location_type: s(a.locationType),
      location_name: s(a.locationName), sku: s(a.sku), item_name: s(a.itemName), adjustment_type: s(a.adjustmentType),
      quantity_delta: n(a.quantityDelta), unit_cost: n(a.unitCost), total_delta_value: n(a.totalDeltaValue),
      staff_name: s(a.staffName), date: s(a.date), reason: s(a.reason),
    });
  }

  const insertStocktake = db.prepare(`
    INSERT INTO stocktakes (id, batch_no, location_id, location_type, location_name, date, auditor_staff_name, status, items_count, counted_qty, book_qty, variance_units, valuation_delta, notes)
    VALUES (@id, @batch_no, @location_id, @location_type, @location_name, @date, @auditor_staff_name, @status, @items_count, @counted_qty, @book_qty, @variance_units, @valuation_delta, @notes)
  `);
  for (const st of mock.INITIAL_STOCKTAKES) {
    insertStocktake.run({
      id: st.id, batch_no: s(st.batchNo), location_id: s(st.locationId), location_type: s(st.locationType),
      location_name: s(st.locationName), date: s(st.date), auditor_staff_name: s(st.auditorStaffName),
      status: s(st.status, 'DRAFT'), items_count: n(st.itemsCount), counted_qty: n(st.countedQty),
      book_qty: n(st.bookQty), variance_units: n(st.varianceUnits), valuation_delta: n(st.valuationDelta), notes: s(st.notes),
    });
  }

  const insertSession = db.prepare(`
    INSERT INTO stocktake_sessions (id, session_number, title, location_id, location_type, location_name, department_filter, is_blind_count, status, created_by_staff_id, created_by_staff_name, created_date_time, completed_date_time, total_expected_units, total_counted_units, total_variance_units, total_variance_valuation, approval_required, approved_by_staff_name, approved_date_time, approval_notes, notes)
    VALUES (@id, @session_number, @title, @location_id, @location_type, @location_name, @department_filter, @is_blind_count, @status, @created_by_staff_id, @created_by_staff_name, @created_date_time, @completed_date_time, @total_expected_units, @total_counted_units, @total_variance_units, @total_variance_valuation, @approval_required, @approved_by_staff_name, @approved_date_time, @approval_notes, @notes)
  `);
  const insertLine = db.prepare(`
    INSERT INTO stocktake_lines (session_id, sku, barcode, name, category, bin_location, unit_cost, retail_price, book_qty, counted_qty, variance_qty, variance_valuation, reason_code, notes, last_counted_timestamp, counted_by_staff_name, exception_id)
    VALUES (@session_id, @sku, @barcode, @name, @category, @bin_location, @unit_cost, @retail_price, @book_qty, @counted_qty, @variance_qty, @variance_valuation, @reason_code, @notes, @last_counted_timestamp, @counted_by_staff_name, @exception_id)
  `);
  for (const sess of mock.INITIAL_STOCKTAKE_SESSIONS) {
    insertSession.run({
      id: sess.id, session_number: s(sess.sessionNumber), title: s(sess.title), location_id: s(sess.locationId),
      location_type: s(sess.locationType), location_name: s(sess.locationName), department_filter: s(sess.departmentFilter),
      is_blind_count: bool(sess.isBlindCount), status: s(sess.status, 'DRAFT'), created_by_staff_id: s(sess.createdByStaffId),
      created_by_staff_name: s(sess.createdByStaffName), created_date_time: s(sess.createdDateTime),
      completed_date_time: s(sess.completedDateTime), total_expected_units: n(sess.totalExpectedUnits),
      total_counted_units: n(sess.totalCountedUnits), total_variance_units: n(sess.totalVarianceUnits),
      total_variance_valuation: n(sess.totalVarianceValuation), approval_required: bool(sess.approvalRequired),
      approved_by_staff_name: s(sess.approvedByStaffName), approved_date_time: s(sess.approvedDateTime),
      approval_notes: s(sess.approvalNotes), notes: s(sess.notes),
    });
    for (const line of sess.items || []) {
      insertLine.run({
        session_id: sess.id, sku: s(line.sku), barcode: s(line.barcode), name: s(line.name), category: s(line.category),
        bin_location: s(line.binLocation), unit_cost: n(line.unitCost), retail_price: n(line.retailPrice),
        book_qty: n(line.bookQty), counted_qty: line.countedQty ?? null, variance_qty: n(line.varianceQty),
        variance_valuation: n(line.varianceValuation), reason_code: s(line.reasonCode), notes: s(line.notes),
        last_counted_timestamp: s(line.lastCountedTimestamp), counted_by_staff_name: s(line.countedByStaffName),
        exception_id: s(line.exceptionId),
      });
    }
  }
}

function seedSales() {
  const insertSale = db.prepare(`
    INSERT INTO sales_transactions (sale_id, sale_number, date_time, customer_id, customer_name, cashier_id, cashier_name, subtotal, tax_total, discount_total, grand_total, change_given, transaction_type, status, terminal_id, shift_id, branch_id, branch_name, idempotency_key, total_cost_basis, gross_margin, notes)
    VALUES (@sale_id, @sale_number, @date_time, @customer_id, @customer_name, @cashier_id, @cashier_name, @subtotal, @tax_total, @discount_total, @grand_total, @change_given, @transaction_type, @status, @terminal_id, @shift_id, @branch_id, @branch_name, @idempotency_key, @total_cost_basis, @gross_margin, @notes)
  `);
  const insertLine = db.prepare(`
    INSERT INTO sale_line_items (sale_id, sku, item_name, part_number, oem_number, quantity, unit_price, discount_percent, discount_amount, tax_rate, tax_amount, unit_cost_basis, cost_total, net_subtotal, line_total)
    VALUES (@sale_id, @sku, @item_name, @part_number, @oem_number, @quantity, @unit_price, @discount_percent, @discount_amount, @tax_rate, @tax_amount, @unit_cost_basis, @cost_total, @net_subtotal, @line_total)
  `);
  const insertPayment = db.prepare(`
    INSERT INTO sale_payments (sale_id, method, amount, reference) VALUES (@sale_id, @method, @amount, @reference)
  `);
  for (const sale of mock.INITIAL_SALES_TRANSACTIONS as any[]) {
    const saleId = sale.saleId || generateId('SALE');
    insertSale.run({
      sale_id: saleId, sale_number: sale.saleNumber, date_time: sale.dateTime,
      customer_id: s(sale.customer?.id), customer_name: s(sale.customer?.name), cashier_id: s(sale.cashier?.id),
      cashier_name: s(sale.cashier?.name), subtotal: n(sale.subtotal), tax_total: n(sale.taxTotal),
      discount_total: n(sale.discountTotal), grand_total: n(sale.grandTotal), change_given: n(sale.changeGiven),
      transaction_type: sale.transactionType, status: s(sale.status, 'COMPLETED'), terminal_id: s(sale.terminalId),
      shift_id: s(sale.shiftId), branch_id: s(sale.branchId), branch_name: s(sale.branchName),
      idempotency_key: s(sale.idempotencyKey), total_cost_basis: sale.totalCostBasis ?? null,
      gross_margin: sale.grossMargin ?? null, notes: s(sale.notes),
    });
    for (const line of sale.items || []) {
      insertLine.run({
        sale_id: saleId, sku: s(line.sku || line.item?.sku), item_name: s(line.itemName || line.item?.name || line.item?.description),
        part_number: s(line.partNumber), oem_number: s(line.oemNumber), quantity: n(line.quantity),
        unit_price: n(line.unitPrice), discount_percent: n(line.discountPercent), discount_amount: n(line.discountAmount),
        tax_rate: n(line.taxRate), tax_amount: n(line.taxAmount), unit_cost_basis: n(line.unitCostBasis),
        cost_total: n(line.costTotal), net_subtotal: n(line.netSubtotal), line_total: n(line.lineTotal),
      });
    }
    for (const p of sale.payments || []) {
      insertPayment.run({ sale_id: saleId, method: p.method, amount: n(p.amount), reference: s(p.reference) });
    }
  }
}

function seedHeldAndLayaway() {
  const insertHeld = db.prepare(`
    INSERT INTO held_sales (id, sale_number, customer_id, customer_name, cashier_id, cashier_name, subtotal, grand_total, date_time, expected_settlement_time, status, notes, settled_date_time, converted_by_staff)
    VALUES (@id, @sale_number, @customer_id, @customer_name, @cashier_id, @cashier_name, @subtotal, @grand_total, @date_time, @expected_settlement_time, @status, @notes, @settled_date_time, @converted_by_staff)
  `);
  const insertHeldItem = db.prepare(`
    INSERT INTO held_sale_items (held_sale_id, sku, item_name, quantity, unit_price, discount_percent, tax_amount, line_total)
    VALUES (@held_sale_id, @sku, @item_name, @quantity, @unit_price, @discount_percent, @tax_amount, @line_total)
  `);
  for (const hs of mock.INITIAL_HELD_SALES) {
    insertHeld.run({
      id: hs.id, sale_number: s(hs.saleNumber), customer_id: s(hs.customer?.id), customer_name: s(hs.customer?.name),
      cashier_id: s(hs.cashier?.id), cashier_name: s(hs.cashier?.name), subtotal: n(hs.subtotal), grand_total: n(hs.grandTotal),
      date_time: s(hs.dateTime), expected_settlement_time: s(hs.expectedSettlementTime), status: s(hs.status, 'OUTSTANDING'),
      notes: s(hs.notes), settled_date_time: s((hs as any).settledDateTime), converted_by_staff: s((hs as any).convertedByStaff),
    });
    for (const line of hs.items || []) {
      insertHeldItem.run({
        held_sale_id: hs.id, sku: s(line.sku || line.item?.sku), item_name: s(line.itemName || line.item?.name),
        quantity: n(line.quantity), unit_price: n(line.unitPrice), discount_percent: n(line.discountPercent),
        tax_amount: n(line.taxAmount), line_total: n(line.lineTotal),
      });
    }
  }

  const insertReceipt = db.prepare(`
    INSERT INTO held_receipts (id, cashier_id, cashier_name, customer_id, customer_name, parked_at, note, total_amount)
    VALUES (@id, @cashier_id, @cashier_name, @customer_id, @customer_name, @parked_at, @note, @total_amount)
  `);
  const insertReceiptItem = db.prepare(`
    INSERT INTO held_receipt_items (held_receipt_id, sku, item_name, quantity, unit_price, discount_percent, tax_amount, line_total)
    VALUES (@held_receipt_id, @sku, @item_name, @quantity, @unit_price, @discount_percent, @tax_amount, @line_total)
  `);
  for (const hr of mock.INITIAL_HELD_RECEIPTS) {
    insertReceipt.run({
      id: hr.id, cashier_id: s(hr.cashier?.id), cashier_name: s(hr.cashier?.name), customer_id: s(hr.customer?.id),
      customer_name: s(hr.customer?.name), parked_at: s(hr.parkedAt), note: s(hr.note), total_amount: n(hr.totalAmount),
    });
    for (const line of hr.items || []) {
      insertReceiptItem.run({
        held_receipt_id: hr.id, sku: s(line.sku || line.item?.sku), item_name: s(line.itemName || line.item?.name),
        quantity: n(line.quantity), unit_price: n(line.unitPrice), discount_percent: n(line.discountPercent),
        tax_amount: n(line.taxAmount), line_total: n(line.lineTotal),
      });
    }
  }

  const insertLayaway = db.prepare(`
    INSERT INTO layaway_orders (id, customer_id, customer_name, cashier_id, cashier_name, total_amount, amount_paid, balance_remaining, next_expected_payment_date, deposit_percent, created_date, expiry_date, status, converted_sale_number)
    VALUES (@id, @customer_id, @customer_name, @cashier_id, @cashier_name, @total_amount, @amount_paid, @balance_remaining, @next_expected_payment_date, @deposit_percent, @created_date, @expiry_date, @status, @converted_sale_number)
  `);
  const insertLayItem = db.prepare(`
    INSERT INTO layaway_items (layaway_id, sku, item_name, quantity, unit_price, discount_percent, tax_amount, line_total)
    VALUES (@layaway_id, @sku, @item_name, @quantity, @unit_price, @discount_percent, @tax_amount, @line_total)
  `);
  const insertLayPayment = db.prepare(`
    INSERT INTO layaway_payments (layaway_id, date, amount, method, cashier_name, receipt_no)
    VALUES (@layaway_id, @date, @amount, @method, @cashier_name, @receipt_no)
  `);
  for (const lay of mock.INITIAL_LAYAWAY_ORDERS) {
    insertLayaway.run({
      id: lay.id, customer_id: s(lay.customer?.id), customer_name: s(lay.customer?.name), cashier_id: s(lay.cashier?.id),
      cashier_name: s(lay.cashier?.name), total_amount: n(lay.totalAmount), amount_paid: n(lay.amountPaid),
      balance_remaining: n(lay.balanceRemaining), next_expected_payment_date: s(lay.nextExpectedPaymentDate),
      deposit_percent: n(lay.depositPercent), created_date: s(lay.createdDate), expiry_date: s(lay.expiryDate),
      status: s(lay.status, 'ACTIVE'), converted_sale_number: s((lay as any).convertedSaleNumber),
    });
    for (const line of lay.reservedItems || []) {
      insertLayItem.run({
        layaway_id: lay.id, sku: s(line.sku || line.item?.sku), item_name: s(line.itemName || line.item?.name),
        quantity: n(line.quantity), unit_price: n(line.unitPrice), discount_percent: n(line.discountPercent),
        tax_amount: n(line.taxAmount), line_total: n(line.lineTotal),
      });
    }
    for (const p of lay.paymentHistory || []) {
      insertLayPayment.run({
        layaway_id: lay.id, date: s(p.date), amount: n(p.amount), method: p.method, cashier_name: s(p.cashierName),
        receipt_no: s(p.receiptNo),
      });
    }
  }

  const insertCN = db.prepare(`
    INSERT INTO credit_notes (id, original_sale_number, customer_id, customer_name, cashier_id, cashier_name, date_time, total_refund_amount, refund_method, reason_category, status)
    VALUES (@id, @original_sale_number, @customer_id, @customer_name, @cashier_id, @cashier_name, @date_time, @total_refund_amount, @refund_method, @reason_category, @status)
  `);
  const insertCNItem = db.prepare(`
    INSERT INTO credit_note_items (credit_note_id, sku, item_name, return_qty, unit_price, reason, restock)
    VALUES (@credit_note_id, @sku, @item_name, @return_qty, @unit_price, @reason, @restock)
  `);
  for (const cn of mock.INITIAL_CREDIT_NOTES) {
    insertCN.run({
      id: cn.id, original_sale_number: s(cn.originalSaleNumber), customer_id: s(cn.customer?.id),
      customer_name: s(cn.customer?.name), cashier_id: s(cn.cashier?.id), cashier_name: s(cn.cashier?.name),
      date_time: s(cn.dateTime), total_refund_amount: n(cn.totalRefundAmount), refund_method: cn.refundMethod,
      reason_category: s(cn.reasonCategory), status: s(cn.status, 'ISSUED'),
    });
    for (const ri of cn.returnedItems || []) {
      insertCNItem.run({
        credit_note_id: cn.id, sku: s(ri.item?.sku), item_name: s(ri.item?.name || ri.item?.description),
        return_qty: n(ri.returnQty), unit_price: n(ri.unitPrice), reason: s(ri.reason), restock: bool(ri.restock),
      });
    }
  }
}

function seedShiftsAndEod() {
  const insertShift = db.prepare(`
    INSERT INTO shifts (id, shift_number, terminal_id, terminal_name, branch_id, branch_name, cashier_staff_id, cashier_staff_name, opened_date_time, opening_date, opening_float, opening_notes, closed_date_time, closing_float, status, expected_cash, counted_cash, cash_variance, cash_variance_tolerance, cash_up_mode, close_policy, total_sales_count, gross_sales, total_cash_sales, total_mobile_money_sales, total_card_sales, total_credit_sales, total_refunds, total_payouts, total_held_sales, total_layaway_receipts, tender_reconciliation, cash_movements, reconciliation_snapshot, closure_reason_code, cash_discrepancy_severity, closing_notes, approved_by_staff_name, approved_date_time)
    VALUES (@id, @shift_number, @terminal_id, @terminal_name, @branch_id, @branch_name, @cashier_staff_id, @cashier_staff_name, @opened_date_time, @opening_date, @opening_float, @opening_notes, @closed_date_time, @closing_float, @status, @expected_cash, @counted_cash, @cash_variance, @cash_variance_tolerance, @cash_up_mode, @close_policy, @total_sales_count, @gross_sales, @total_cash_sales, @total_mobile_money_sales, @total_card_sales, @total_credit_sales, @total_refunds, @total_payouts, @total_held_sales, @total_layaway_receipts, @tender_reconciliation, @cash_movements, @reconciliation_snapshot, @closure_reason_code, @cash_discrepancy_severity, @closing_notes, @approved_by_staff_name, @approved_date_time)
  `);
  for (const sh of mock.INITIAL_SHIFTS as any[]) {
    insertShift.run({
      id: sh.id, shift_number: s(sh.shiftNumber), terminal_id: s(sh.terminalId), terminal_name: s(sh.terminalName),
      branch_id: s(sh.branchId), branch_name: s(sh.branchName), cashier_staff_id: s(sh.cashierStaffId),
      cashier_staff_name: s(sh.cashierStaffName), opened_date_time: s(sh.openedDateTime), opening_date: s(sh.openingDate),
      opening_float: n(sh.openingFloat), opening_notes: s(sh.openingNotes), closed_date_time: s(sh.closedDateTime),
      closing_float: sh.closingFloat ?? null, status: s(sh.status, 'OPEN'), expected_cash: n(sh.expectedCash),
      counted_cash: sh.countedCash ?? null, cash_variance: sh.cashVariance ?? null,
      cash_variance_tolerance: sh.cashVarianceTolerance ?? null, cash_up_mode: s(sh.cashUpMode),
      close_policy: s(sh.closePolicy), total_sales_count: n(sh.totalSalesCount), gross_sales: n(sh.grossSales),
      total_cash_sales: n(sh.totalCashSales), total_mobile_money_sales: n(sh.totalMobileMoneySales),
      total_card_sales: n(sh.totalCardSales), total_credit_sales: n(sh.totalCreditSales), total_refunds: n(sh.totalRefunds),
      total_payouts: n(sh.totalPayouts), total_held_sales: n(sh.totalHeldSales),
      total_layaway_receipts: n(sh.totalLayawayReceipts), tender_reconciliation: j(sh.tenderReconciliation || []),
      cash_movements: j(sh.cashMovements || {}), reconciliation_snapshot: j(sh.reconciliationSnapshot || null),
      closure_reason_code: s(sh.closureReasonCode), cash_discrepancy_severity: s(sh.cashDiscrepancySeverity),
      closing_notes: s(sh.closingNotes), approved_by_staff_name: s(sh.approvedByStaffName),
      approved_date_time: s(sh.approvedDateTime),
    });
  }

  const insertEod = db.prepare(`
    INSERT INTO eod_reports (id, report_number, date, branch_id, branch_name, terminal_id, terminal_name, generated_by_staff_id, generated_by_staff_name, status, total_sales, total_cash_expected, total_cash_counted, total_variance, unresolved_held_sales_count, unresolved_held_sales_value, unapproved_refunds_count, unapproved_refunds_value, open_tills_count, pending_stock_adjustments_count, manager_approved_by, manager_approval_date, manager_notes, created_date_time)
    VALUES (@id, @report_number, @date, @branch_id, @branch_name, @terminal_id, @terminal_name, @generated_by_staff_id, @generated_by_staff_name, @status, @total_sales, @total_cash_expected, @total_cash_counted, @total_variance, @unresolved_held_sales_count, @unresolved_held_sales_value, @unapproved_refunds_count, @unapproved_refunds_value, @open_tills_count, @pending_stock_adjustments_count, @manager_approved_by, @manager_approval_date, @manager_notes, @created_date_time)
  `);
  const insertEodLine = db.prepare(`
    INSERT INTO eod_reconciliation_entries (eod_report_id, category, label, expected_amount, counted_amount, variance, notes)
    VALUES (@eod_report_id, @category, @label, @expected_amount, @counted_amount, @variance, @notes)
  `);
  for (const eod of mock.INITIAL_EOD_REPORTS) {
    insertEod.run({
      id: eod.id, report_number: s(eod.reportNumber), date: s(eod.date), branch_id: s(eod.branchId),
      branch_name: s(eod.branchName), terminal_id: s(eod.terminalId), terminal_name: s(eod.terminalName),
      generated_by_staff_id: s(eod.generatedByStaffId), generated_by_staff_name: s(eod.generatedByStaffName),
      status: s(eod.status, 'DRAFT'), total_sales: n(eod.totalSales), total_cash_expected: n(eod.totalCashExpected),
      total_cash_counted: n(eod.totalCashCounted), total_variance: n(eod.totalVariance),
      unresolved_held_sales_count: n(eod.unresolvedHeldSalesCount), unresolved_held_sales_value: n(eod.unresolvedHeldSalesValue),
      unapproved_refunds_count: n(eod.unapprovedRefundsCount), unapproved_refunds_value: n(eod.unapprovedRefundsValue),
      open_tills_count: n(eod.openTillsCount), pending_stock_adjustments_count: n(eod.pendingStockAdjustmentsCount),
      manager_approved_by: s(eod.managerApprovedBy), manager_approval_date: s(eod.managerApprovalDate),
      manager_notes: s(eod.managerNotes), created_date_time: s(eod.createdDateTime),
    });
    for (const line of eod.reconciliation || []) {
      insertEodLine.run({
        eod_report_id: eod.id, category: line.category, label: s(line.label), expected_amount: n(line.expectedAmount),
        counted_amount: n(line.countedAmount), variance: n(line.variance), notes: s(line.notes),
      });
    }
  }
}

function seedPurchasingAndLogistics() {
  const insertMemo = db.prepare(`
    INSERT INTO purchase_memos (id, memo_number, supplier_name, supplier_code, request_date, required_date, requested_by_staff_id, requested_by_staff_name, department, destination_warehouse_id, destination_warehouse_name, priority, status, notes, converted_po_number, approved_by_staff_name, approval_date)
    VALUES (@id, @memo_number, @supplier_name, @supplier_code, @request_date, @required_date, @requested_by_staff_id, @requested_by_staff_name, @department, @destination_warehouse_id, @destination_warehouse_name, @priority, @status, @notes, @converted_po_number, @approved_by_staff_name, @approval_date)
  `);
  const insertMemoItem = db.prepare(`
    INSERT INTO purchase_memo_items (memo_id, sku, description, requested_qty, estimated_unit_cost, notes)
    VALUES (@memo_id, @sku, @description, @requested_qty, @estimated_unit_cost, @notes)
  `);
  for (const memo of mock.INITIAL_PURCHASE_MEMOS as any[]) {
    insertMemo.run({
      id: memo.id, memo_number: s(memo.memoNumber), supplier_name: s(memo.supplierName), supplier_code: s(memo.supplierCode),
      request_date: s(memo.requestDate), required_date: s(memo.requiredDate), requested_by_staff_id: s(memo.requestedByStaffId),
      requested_by_staff_name: s(memo.requestedByStaffName), department: s(memo.department),
      destination_warehouse_id: s(memo.destinationWarehouseId), destination_warehouse_name: s(memo.destinationWarehouseName),
      priority: s(memo.priority, 'MEDIUM'), status: s(memo.status, 'Draft'), notes: s(memo.notes),
      converted_po_number: s(memo.convertedPoNumber), approved_by_staff_name: s(memo.approvedByStaffName),
      approval_date: s(memo.approvalDate),
    });
    for (const line of memo.items || []) {
      insertMemoItem.run({
        memo_id: memo.id, sku: s(line.sku), description: s(line.description), requested_qty: n(line.requestedQty),
        estimated_unit_cost: line.estimatedUnitCost ?? null, notes: s(line.notes),
      });
    }
  }

  const insertPO = db.prepare(`
    INSERT INTO purchase_orders (po_number, supplier_name, supplier_code, date_created, delivery_due_date, destination_warehouse_id, destination_warehouse_name, total_items, subtotal, tax_rate, tax_amount, total_amount, currency, status, payment_terms, authorized_by, notes, origin_memo_number)
    VALUES (@po_number, @supplier_name, @supplier_code, @date_created, @delivery_due_date, @destination_warehouse_id, @destination_warehouse_name, @total_items, @subtotal, @tax_rate, @tax_amount, @total_amount, @currency, @status, @payment_terms, @authorized_by, @notes, @origin_memo_number)
  `);
  const insertPOItem = db.prepare(`
    INSERT INTO purchase_order_items (po_number, sku, description, ordered_qty, received_qty, unit_cost, total_cost)
    VALUES (@po_number, @sku, @description, @ordered_qty, @received_qty, @unit_cost, @total_cost)
  `);
  for (const po of mock.INITIAL_PURCHASE_ORDERS) {
    insertPO.run({
      po_number: po.poNumber, supplier_name: po.supplierName, supplier_code: s(po.supplierCode),
      date_created: s(po.dateCreated), delivery_due_date: s(po.deliveryDueDate),
      destination_warehouse_id: s(po.destinationWarehouseId), destination_warehouse_name: s(po.destinationWarehouseName),
      total_items: n(po.totalItems), subtotal: po.subtotal ?? null, tax_rate: po.taxRate ?? null,
      tax_amount: po.taxAmount ?? null, total_amount: n(po.totalAmount), currency: s(po.currency, 'USD'),
      status: s(po.status, 'Open'), payment_terms: s(po.paymentTerms), authorized_by: s(po.authorizedBy),
      notes: s(po.notes), origin_memo_number: s(po.originMemoNumber),
    });
    for (const line of po.items || []) {
      insertPOItem.run({
        po_number: po.poNumber, sku: s(line.sku), description: s(line.description), ordered_qty: n(line.orderedQty),
        received_qty: n(line.receivedQty), unit_cost: n(line.unitCost), total_cost: n(line.totalCost),
      });
    }
  }

  const insertTransfer = db.prepare(`
    INSERT INTO stock_transfers (id, transfer_number, flow_type, origin_location_id, origin_location_type, origin_location_name, destination_location_id, destination_location_type, destination_location_name, request_date, status, requested_by_staff_name, approved_by_staff_name, approved_date, dispatched_by_staff_name, dispatched_date, carrier_or_vehicle, dispatch_notes, received_by_staff_name, received_date, receiving_notes, rejection_reason, notes, has_discrepancy, discrepancy_reason, discrepancy_notes)
    VALUES (@id, @transfer_number, @flow_type, @origin_location_id, @origin_location_type, @origin_location_name, @destination_location_id, @destination_location_type, @destination_location_name, @request_date, @status, @requested_by_staff_name, @approved_by_staff_name, @approved_date, @dispatched_by_staff_name, @dispatched_date, @carrier_or_vehicle, @dispatch_notes, @received_by_staff_name, @received_date, @receiving_notes, @rejection_reason, @notes, @has_discrepancy, @discrepancy_reason, @discrepancy_notes)
  `);
  const insertTransferItem = db.prepare(`
    INSERT INTO stock_transfer_items (transfer_id, sku, description, requested_qty, dispatched_qty, received_qty, variance_qty, discrepancy_reason, discrepancy_notes, unit_cost)
    VALUES (@transfer_id, @sku, @description, @requested_qty, @dispatched_qty, @received_qty, @variance_qty, @discrepancy_reason, @discrepancy_notes, @unit_cost)
  `);
  for (const t of mock.INITIAL_STOCK_TRANSFERS as any[]) {
    insertTransfer.run({
      id: t.id, transfer_number: s(t.transferNumber), flow_type: s(t.flowType),
      origin_location_id: s(t.originLocationId || t.sourceLocationId), origin_location_type: s(t.originLocationType || t.sourceLocationType),
      origin_location_name: s(t.originLocationName || t.sourceLocationName), destination_location_id: s(t.destinationLocationId),
      destination_location_type: s(t.destinationLocationType), destination_location_name: s(t.destinationLocationName),
      request_date: s(t.requestDate || t.requestedDate), status: s(t.status, 'Draft'),
      requested_by_staff_name: s(t.requestedByStaffName), approved_by_staff_name: s(t.approvedByStaffName),
      approved_date: s(t.approvedDate), dispatched_by_staff_name: s(t.dispatchedByStaffName),
      dispatched_date: s(t.dispatchedDate), carrier_or_vehicle: s(t.carrierOrVehicle || t.carrierVehicle),
      dispatch_notes: s(t.dispatchNotes), received_by_staff_name: s(t.receivedByStaffName),
      received_date: s(t.receivedDate), receiving_notes: s(t.receivingNotes), rejection_reason: s(t.rejectionReason),
      notes: s(t.notes), has_discrepancy: bool(t.hasDiscrepancy), discrepancy_reason: s(t.discrepancyReason),
      discrepancy_notes: s(t.discrepancyNotes),
    });
    for (const line of t.items || []) {
      insertTransferItem.run({
        transfer_id: t.id, sku: s(line.sku), description: s(line.description), requested_qty: n(line.requestedQty),
        dispatched_qty: n(line.dispatchedQty), received_qty: n(line.receivedQty), variance_qty: line.varianceQty ?? null,
        discrepancy_reason: s(line.discrepancyReason), discrepancy_notes: s(line.discrepancyNotes), unit_cost: n(line.unitCost),
      });
    }
  }
}

function seedFinancial() {
  const insertDebtor = db.prepare(`
    INSERT INTO debtor_transactions (id, customer_id, customer_name, account_number, date_time, transaction_type, reference_number, description, debit, credit, running_balance, due_date, status, allocated_amount, payment_method, notes, cashier_or_staff_name)
    VALUES (@id, @customer_id, @customer_name, @account_number, @date_time, @transaction_type, @reference_number, @description, @debit, @credit, @running_balance, @due_date, @status, @allocated_amount, @payment_method, @notes, @cashier_or_staff_name)
  `);
  for (const d of mock.INITIAL_DEBTOR_TRANSACTIONS as any[]) {
    insertDebtor.run({
      id: d.id, customer_id: s(d.customerId), customer_name: s(d.customerName), account_number: s(d.accountNumber),
      date_time: s(d.dateTime), transaction_type: d.transactionType, reference_number: s(d.referenceNumber),
      description: s(d.description), debit: n(d.debit), credit: n(d.credit), running_balance: n(d.runningBalance),
      due_date: s(d.dueDate), status: s(d.status, 'UNPAID'), allocated_amount: d.allocatedAmount ?? null,
      payment_method: s(d.paymentMethod), notes: s(d.notes), cashier_or_staff_name: s(d.cashierOrStaffName),
    });
  }

  const insertCreditor = db.prepare(`
    INSERT INTO creditor_transactions (id, supplier_code, supplier_name, date_time, transaction_type, reference_number, description, invoice_amount, payment_amount, running_balance, due_date, status, payment_method, authorized_by_staff_name, notes)
    VALUES (@id, @supplier_code, @supplier_name, @date_time, @transaction_type, @reference_number, @description, @invoice_amount, @payment_amount, @running_balance, @due_date, @status, @payment_method, @authorized_by_staff_name, @notes)
  `);
  for (const c of mock.INITIAL_CREDITOR_TRANSACTIONS as any[]) {
    insertCreditor.run({
      id: c.id, supplier_code: s(c.supplierCode), supplier_name: s(c.supplierName), date_time: s(c.dateTime),
      transaction_type: c.transactionType, reference_number: s(c.referenceNumber), description: s(c.description),
      invoice_amount: n(c.invoiceAmount), payment_amount: n(c.paymentAmount), running_balance: n(c.runningBalance),
      due_date: s(c.dueDate), status: s(c.status, 'PENDING'), payment_method: s(c.paymentMethod),
      authorized_by_staff_name: s(c.authorizedByStaffName), notes: s(c.notes),
    });
  }

  const insertAcct = db.prepare(`
    INSERT INTO cash_bank_accounts (id, code, name, account_type, account_number, institution_or_provider, branch_id, branch_name, currency, current_balance, opening_balance, status, is_default, requires_dual_approval_for_transfer, max_daily_outflow_limit, last_reconciled_date, notes)
    VALUES (@id, @code, @name, @account_type, @account_number, @institution_or_provider, @branch_id, @branch_name, @currency, @current_balance, @opening_balance, @status, @is_default, @requires_dual_approval_for_transfer, @max_daily_outflow_limit, @last_reconciled_date, @notes)
  `);
  for (const a of mock.INITIAL_CASH_BANK_ACCOUNTS as any[]) {
    insertAcct.run({
      id: a.id, code: s(a.code), name: a.name, account_type: a.accountType, account_number: s(a.accountNumber),
      institution_or_provider: s(a.institutionOrProvider), branch_id: s(a.branchId), branch_name: s(a.branchName),
      currency: s(a.currency, 'USD'), current_balance: n(a.currentBalance), opening_balance: n(a.openingBalance),
      status: s(a.status, 'ACTIVE'), is_default: bool(a.isDefault),
      requires_dual_approval_for_transfer: bool(a.requiresDualApprovalForTransfer),
      max_daily_outflow_limit: a.maxDailyOutflowLimit ?? null, last_reconciled_date: s(a.lastReconciledDate), notes: s(a.notes),
    });
  }

  const insertCbt = db.prepare(`
    INSERT INTO cash_bank_transactions (id, account_id, account_name, date_time, movement_type, amount, fee_amount, balance_after, reference_number, counter_account_id, counter_account_name, description, performed_by_staff_id, performed_by_staff_name, approved_by_staff_name, status, receipt_or_slip_number, notes)
    VALUES (@id, @account_id, @account_name, @date_time, @movement_type, @amount, @fee_amount, @balance_after, @reference_number, @counter_account_id, @counter_account_name, @description, @performed_by_staff_id, @performed_by_staff_name, @approved_by_staff_name, @status, @receipt_or_slip_number, @notes)
  `);
  for (const t of mock.INITIAL_CASH_BANK_TRANSACTIONS as any[]) {
    insertCbt.run({
      id: t.id, account_id: s(t.accountId), account_name: s(t.accountName), date_time: s(t.dateTime),
      movement_type: t.movementType, amount: n(t.amount), fee_amount: t.feeAmount ?? null, balance_after: n(t.balanceAfter),
      reference_number: s(t.referenceNumber), counter_account_id: s(t.counterAccountId),
      counter_account_name: s(t.counterAccountName), description: s(t.description),
      performed_by_staff_id: s(t.performedByStaffId), performed_by_staff_name: s(t.performedByStaffName),
      approved_by_staff_name: s(t.approvedByStaffName), status: s(t.status, 'POSTED'),
      receipt_or_slip_number: s(t.receiptOrSlipNumber), notes: s(t.notes),
    });
  }

  const insertCm = db.prepare(`
    INSERT INTO cash_movements (id, movement_number, category, source_account_id, source_account_name, destination_account_id, destination_account_name, amount, reason_category, description, receipt_slip_number, bag_seal_number, denomination_breakdown, requested_by_staff_id, requested_by_staff_name, is_sensitive, requires_approval, approval_status, approved_by_staff_name, approved_date_time, date_time)
    VALUES (@id, @movement_number, @category, @source_account_id, @source_account_name, @destination_account_id, @destination_account_name, @amount, @reason_category, @description, @receipt_slip_number, @bag_seal_number, @denomination_breakdown, @requested_by_staff_id, @requested_by_staff_name, @is_sensitive, @requires_approval, @approval_status, @approved_by_staff_name, @approved_date_time, @date_time)
  `);
  for (const cm of mock.INITIAL_CASH_MOVEMENTS as any[]) {
    insertCm.run({
      id: cm.id, movement_number: s(cm.movementNumber), category: cm.category, source_account_id: s(cm.sourceAccountId),
      source_account_name: s(cm.sourceAccountName), destination_account_id: s(cm.destinationAccountId),
      destination_account_name: s(cm.destinationAccountName), amount: n(cm.amount), reason_category: s(cm.reasonCategory),
      description: s(cm.description), receipt_slip_number: s(cm.receiptSlipNumber), bag_seal_number: s(cm.bagSealNumber),
      denomination_breakdown: j(cm.denominationBreakdown || {}), requested_by_staff_id: s(cm.requestedByStaffId),
      requested_by_staff_name: s(cm.requestedByStaffName), is_sensitive: bool(cm.isSensitive),
      requires_approval: bool(cm.requiresApproval), approval_status: s(cm.approvalStatus, 'NOT_REQUIRED'),
      approved_by_staff_name: s(cm.approvedByStaffName), approved_date_time: s(cm.approvedDateTime), date_time: s(cm.dateTime),
    });
  }

  const insertReserve = db.prepare(`
    INSERT INTO business_reserves (id, code, name, category, target_amount, current_funded_balance, allocation_rule_percent, linked_bank_account_id, linked_bank_account_name, description, priority, status, last_contribution_date, last_drawdown_date)
    VALUES (@id, @code, @name, @category, @target_amount, @current_funded_balance, @allocation_rule_percent, @linked_bank_account_id, @linked_bank_account_name, @description, @priority, @status, @last_contribution_date, @last_drawdown_date)
  `);
  for (const r of mock.INITIAL_BUSINESS_RESERVES) {
    insertReserve.run({
      id: r.id, code: s(r.code), name: r.name, category: r.category, target_amount: n(r.targetAmount),
      current_funded_balance: n(r.currentFundedBalance), allocation_rule_percent: n(r.allocationRulePercent),
      linked_bank_account_id: s(r.linkedBankAccountId), linked_bank_account_name: s(r.linkedBankAccountName),
      description: s(r.description), priority: s(r.priority, 'MEDIUM'), status: s(r.status, 'ACTIVE'),
      last_contribution_date: s(r.lastContributionDate), last_drawdown_date: s(r.lastDrawdownDate),
    });
  }

  const insertReserveTx = db.prepare(`
    INSERT INTO reserve_transfers (id, reserve_id, reserve_name, date_time, type, amount, from_account_name, to_account_name, reference_number, authorized_by_staff_name, notes)
    VALUES (@id, @reserve_id, @reserve_name, @date_time, @type, @amount, @from_account_name, @to_account_name, @reference_number, @authorized_by_staff_name, @notes)
  `);
  for (const rt of mock.INITIAL_RESERVE_TRANSFERS) {
    insertReserveTx.run({
      id: rt.id, reserve_id: s(rt.reserveId), reserve_name: s(rt.reserveName), date_time: s(rt.dateTime), type: rt.type,
      amount: n(rt.amount), from_account_name: s(rt.fromAccountName), to_account_name: s(rt.toAccountName),
      reference_number: s(rt.referenceNumber), authorized_by_staff_name: s(rt.authorizedByStaffName), notes: s(rt.notes),
    });
  }
}

function seedTaxConfig() {
  const tc = mock.INITIAL_TAX_CONFIG;
  db.prepare(`
    INSERT INTO tax_config (id, tax_system_name, tax_registration_number, fiscal_device_serial_number, tax_invoice_header_disclaimer, tax_invoice_footer_disclaimer, tax_inclusive_pricing, currency_symbol)
    VALUES (1, @tax_system_name, @tax_registration_number, @fiscal_device_serial_number, @tax_invoice_header_disclaimer, @tax_invoice_footer_disclaimer, @tax_inclusive_pricing, @currency_symbol)
  `).run({
    tax_system_name: s(tc.taxSystemName), tax_registration_number: s(tc.taxRegistrationNumber),
    fiscal_device_serial_number: s(tc.fiscalDeviceSerialNumber), tax_invoice_header_disclaimer: s(tc.taxInvoiceHeaderDisclaimer),
    tax_invoice_footer_disclaimer: s(tc.taxInvoiceFooterDisclaimer), tax_inclusive_pricing: bool(tc.taxInclusivePricing),
    currency_symbol: s(tc.currencySymbol, '$'),
  });

  const insertCat = db.prepare(`
    INSERT INTO tax_categories (id, code, name, standard_rate, is_compound, is_exempt, is_zero_rated, description, active, fiscal_code)
    VALUES (@id, @code, @name, @standard_rate, @is_compound, @is_exempt, @is_zero_rated, @description, @active, @fiscal_code)
  `);
  for (const cat of tc.categories || []) {
    insertCat.run({
      id: cat.id, code: s(cat.code), name: cat.name, standard_rate: n(cat.standardRate), is_compound: bool(cat.isCompound),
      is_exempt: bool(cat.isExempt), is_zero_rated: bool(cat.isZeroRated), description: s(cat.description),
      active: bool(cat.active ?? true), fiscal_code: s(cat.fiscalCode),
    });
  }

  const insertCls = db.prepare(`
    INSERT INTO tax_classifications (department_or_category, tax_category_id, tax_category_name, tax_rate, item_count)
    VALUES (@department_or_category, @tax_category_id, @tax_category_name, @tax_rate, @item_count)
  `);
  for (const cls of tc.classifications || []) {
    insertCls.run({
      department_or_category: s(cls.departmentOrCategory), tax_category_id: s(cls.taxCategoryId),
      tax_category_name: s(cls.taxCategoryName), tax_rate: n(cls.taxRate), item_count: n(cls.itemCount),
    });
  }
}

function seedGovernance() {
  const insertApproval = db.prepare(`
    INSERT INTO approval_requests (id, request_number, type, title, description, amount, reference_id, reference_type, location_name, requested_by_staff_id, requested_by_staff_name, requested_by_role, requested_date_time, reason, priority, status, decided_by_staff_id, decided_by_staff_name, decided_by_role, decision_date_time, decision_notes, meta)
    VALUES (@id, @request_number, @type, @title, @description, @amount, @reference_id, @reference_type, @location_name, @requested_by_staff_id, @requested_by_staff_name, @requested_by_role, @requested_date_time, @reason, @priority, @status, @decided_by_staff_id, @decided_by_staff_name, @decided_by_role, @decision_date_time, @decision_notes, @meta)
  `);
  for (const a of mock.INITIAL_APPROVAL_REQUESTS as any[]) {
    insertApproval.run({
      id: a.id, request_number: s(a.requestNumber), type: a.type, title: a.title, description: s(a.description),
      amount: a.amount ?? null, reference_id: s(a.referenceId), reference_type: s(a.referenceType),
      location_name: s(a.locationName), requested_by_staff_id: s(a.requestedByStaffId),
      requested_by_staff_name: s(a.requestedByStaffName), requested_by_role: s(a.requestedByRole),
      requested_date_time: s(a.requestedDateTime), reason: s(a.reason), priority: s(a.priority, 'MEDIUM'),
      status: s(a.status, 'PENDING'), decided_by_staff_id: s(a.decidedByStaffId), decided_by_staff_name: s(a.decidedByStaffName),
      decided_by_role: s(a.decidedByRole), decision_date_time: s(a.decisionDateTime), decision_notes: s(a.decisionNotes),
      meta: j(a.meta || {}),
    });
  }

  const insertExc = db.prepare(`
    INSERT INTO operational_exceptions (id, exception_number, title, category, date_time, branch_id, branch_name, terminal_id, terminal_name, staff_id, staff_name, related_transaction_ref, related_event_id, severity, status, variance_amount, variance_units, assigned_or_reviewed_by, reviewed_date_time, resolution, details, opened_at, resolved_at)
    VALUES (@id, @exception_number, @title, @category, @date_time, @branch_id, @branch_name, @terminal_id, @terminal_name, @staff_id, @staff_name, @related_transaction_ref, @related_event_id, @severity, @status, @variance_amount, @variance_units, @assigned_or_reviewed_by, @reviewed_date_time, @resolution, @details, @opened_at, @resolved_at)
  `);
  for (const e of mock.INITIAL_OPERATIONAL_EXCEPTIONS as any[]) {
    insertExc.run({
      id: e.id, exception_number: s(e.exceptionNumber), title: e.title, category: e.category, date_time: s(e.dateTime),
      branch_id: s(e.branchId), branch_name: s(e.branchName), terminal_id: s(e.terminalId), terminal_name: s(e.terminalName),
      staff_id: s(e.staffId), staff_name: s(e.staffName), related_transaction_ref: s(e.relatedTransactionRef),
      related_event_id: s(e.relatedEventId), severity: s(e.severity, 'MEDIUM'), status: s(e.status, 'OPEN'),
      variance_amount: e.varianceAmount ?? null, variance_units: e.varianceUnits ?? null,
      assigned_or_reviewed_by: s(e.assignedOrReviewedBy), reviewed_date_time: s(e.reviewedDateTime),
      resolution: s(e.resolution), details: s(e.details), opened_at: s(e.openedAt), resolved_at: s(e.resolvedAt),
    });
  }

  const insertEvt = db.prepare(`
    INSERT INTO activity_events (id, event_type, timestamp, description, staff_id, staff_name, branch_id, branch_name, terminal_id, reference_document, amount, quantity, metadata)
    VALUES (@id, @event_type, @timestamp, @description, @staff_id, @staff_name, @branch_id, @branch_name, @terminal_id, @reference_document, @amount, @quantity, @metadata)
  `);
  for (const e of mock.INITIAL_ACTIVITY_EVENTS as any[]) {
    insertEvt.run({
      id: e.id || generateId('EVT'), event_type: e.eventType, timestamp: s(e.timestamp || e.occurredAt || e.recordedAt),
      description: s(e.description), staff_id: s(e.staffId), staff_name: s(e.staffName), branch_id: s(e.branchId),
      branch_name: s(e.branchName), terminal_id: s(e.terminalId), reference_document: s(e.referenceDocument),
      amount: e.amount ?? null, quantity: e.quantity ?? null, metadata: j(e.metadata || {}),
    });
  }

  const insertBackup = db.prepare(`
    INSERT INTO backups (backup_id, type, created_at, application_version, schema_version, file_path, file_size, verification_status, checksum, tenant_id, tables_count, records_count, wal_checkpoint_completed, failure_reason, notes, initiated_by_staff_id, initiated_by_staff_name)
    VALUES (@backup_id, @type, @created_at, @application_version, @schema_version, @file_path, @file_size, @verification_status, @checksum, @tenant_id, @tables_count, @records_count, @wal_checkpoint_completed, @failure_reason, @notes, @initiated_by_staff_id, @initiated_by_staff_name)
  `);
  for (const b of mock.INITIAL_BACKUP_MANIFEST as any[]) {
    insertBackup.run({
      backup_id: b.backupId, type: b.type, created_at: b.createdAt, application_version: s(b.applicationVersion),
      schema_version: n(b.schemaVersion, 1), file_path: s(b.filePath), file_size: n(b.fileSize),
      verification_status: s(b.verificationStatus, 'PENDING'), checksum: s(b.checksum), tenant_id: s(b.tenantId),
      tables_count: n(b.tablesCount), records_count: n(b.recordsCount), wal_checkpoint_completed: bool(b.walCheckpointCompleted),
      failure_reason: s(b.failureReason), notes: s(b.notes), initiated_by_staff_id: s(b.initiatedByStaffId),
      initiated_by_staff_name: s(b.initiatedByStaffName),
    });
  }

  const insertBi = db.prepare(`
    INSERT INTO bi_alerts (id, rule_type, category, title, recommendation, explanation, related_record, priority, status, date_time, impact_metric, suggested_action_label, user_response, rule_trigger_criteria)
    VALUES (@id, @rule_type, @category, @title, @recommendation, @explanation, @related_record, @priority, @status, @date_time, @impact_metric, @suggested_action_label, @user_response, @rule_trigger_criteria)
  `);
  for (const alert of INITIAL_BI_ALERTS as any[]) {
    insertBi.run({
      id: alert.id, rule_type: s(alert.ruleType), category: s(alert.category), title: alert.title,
      recommendation: s(alert.recommendation), explanation: s(alert.explanation), related_record: j(alert.relatedRecord || {}),
      priority: s(alert.priority, 'MEDIUM'), status: s(alert.status, 'NEW'), date_time: s(alert.dateTime),
      impact_metric: j(alert.impactMetric || null), suggested_action_label: s(alert.suggestedActionLabel),
      user_response: j(alert.userResponse || null), rule_trigger_criteria: s(alert.ruleTriggerCriteria),
    });
  }
}

function seedRateConfig() {
  // One placeholder v1 row so the settings UI and any future fare-engine
  // consumer never see an empty table on a fresh install — see DL-004 and
  // server/db/migrations/005_rate_config.sql.
  db.prepare(
    `INSERT INTO rate_config (id, version, currency, base_fee, per_km_rate, load_size_surcharge_tiers, ride_type_multipliers, effective_date, created_by_staff_id, created_by_staff_name, created_at, notes)
     VALUES (@id, 1, @currency, @baseFee, @perKmRate, @loadSizeSurchargeTiers, @rideTypeMultipliers, @effectiveDate, @createdByStaffId, @createdByStaffName, @createdAt, @notes)`
  ).run({
    id: generateId('RATE'),
    currency: 'USD',
    baseFee: 2.5,
    perKmRate: 0.75,
    loadSizeSurchargeTiers: j([
      { label: 'Small', maxWeightKg: 5, surcharge: 0 },
      { label: 'Medium', maxWeightKg: 20, surcharge: 1.5 },
      { label: 'Large', maxWeightKg: null, surcharge: 4 },
    ]),
    rideTypeMultipliers: j({ STANDARD: 1.0, EXPRESS: 1.5, SCHEDULED: 0.9 }),
    effectiveDate: new Date().toISOString().slice(0, 10),
    createdByStaffId: null,
    createdByStaffName: 'System Administrator',
    createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    notes: 'Initial placeholder rate version — pending real-world rate-card sign-off.',
  });
}

function seedGenericDomains() {
  for (const dep of mock.INITIAL_DEPARTMENTS as string[]) {
    insertGeneric('departments', generateId('DEPT'), { name: dep });
  }
  for (const uom of mock.INITIAL_UNITS_OF_MEASURE as string[]) {
    insertGeneric('units_of_measure', generateId('UOM'), { name: uom });
  }
  for (const cf of mock.INITIAL_CUSTOM_FIELD_DEFS as any[]) {
    insertGeneric('custom_field_defs', cf.id || generateId('CFD'), cf);
  }
  for (const dev of mock.INITIAL_POS_DEVICES as any[]) {
    insertGeneric('pos_devices', dev.id || generateId('DEV'), dev);
  }
  for (const pmc of mock.INITIAL_PAYMENT_METHODS_CONFIG as any[]) {
    insertGeneric('payment_methods_config', pmc.id || generateId('PMC'), pmc);
  }
  for (const cf of mock.INITIAL_CASH_FLOW_PROJECTIONS as any[]) {
    insertGeneric('cash_flow_projections', cf.id || generateId('CFP'), cf);
  }
  for (const metric of mock.CENTRAL_METRIC_DICTIONARY as any[]) {
    insertGeneric('metric_dictionary', metric.id || generateId('METRIC'), metric);
  }
  insertGeneric('licence_info', 'SINGLETON', mock.INITIAL_LICENCE_INFO);
  insertGeneric('software_update_info', 'SINGLETON', mock.INITIAL_SOFTWARE_UPDATE_INFO);
  insertGeneric('fiscal_config', 'SINGLETON', mock.INITIAL_FISCAL_CONFIG);
}

export function seedIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM staff').get() as { count: number };
  if (count > 0) {
    return;
  }

  console.log('[seed] empty database detected — seeding from mock data...');
  withTransaction(() => {
    seedStaff();
    seedLocations();
    seedParties();
    seedInventory();
    seedSales();
    seedHeldAndLayaway();
    seedShiftsAndEod();
    seedPurchasingAndLogistics();
    seedFinancial();
    seedTaxConfig();
    seedGovernance();
    seedRateConfig();
    seedGenericDomains();
  });
  console.log('[seed] complete.');
}

// Allow running directly: `npm run seed`
const isMainModule = process.argv[1] && process.argv[1].endsWith('seed.ts');
if (isMainModule) {
  seedIfEmpty();
}
