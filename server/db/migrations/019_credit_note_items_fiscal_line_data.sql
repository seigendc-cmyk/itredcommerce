-- credit_note_items previously stored no tax_rate/tax_amount/line_total —
-- fine while nothing needed to reconstruct a line's fiscal breakdown later.
-- Fiscal credit-note submission (fiscalCreditNoteSubmissionService.ts) can
-- retry from a cold drain-loop tick with no in-memory data available, the
-- same reason sale_line_items already stores this trio. Populated at
-- issuance time in issueCreditNote(), frozen from then on (same
-- don't-recompute-from-a-later-live-rate discipline as everything else
-- this codebase's calculation engine touches).
ALTER TABLE credit_note_items ADD COLUMN tax_rate REAL;
ALTER TABLE credit_note_items ADD COLUMN tax_amount REAL;
ALTER TABLE credit_note_items ADD COLUMN line_total REAL;
