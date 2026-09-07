-- Mirrors server/db/migrations/018_credit_note_original_tender_method.sql.
alter table credit_notes add column if not exists original_tender_method_resolved text;
