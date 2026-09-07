-- Mirrors server/db/migrations/019_credit_note_items_fiscal_line_data.sql.
alter table credit_note_items add column if not exists tax_rate numeric(8, 4);
alter table credit_note_items add column if not exists tax_amount numeric(18, 4);
alter table credit_note_items add column if not exists line_total numeric(18, 4);
