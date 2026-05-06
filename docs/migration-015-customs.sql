-- Migration 015: Italian customs declaration fields
-- Adds columns for customs eligibility tracking per item.
-- Declarant profile lives in app settings (localStorage), not DB.

ALTER TABLE cernita_entries
  ADD COLUMN IF NOT EXISTS acquisition_year integer,
  ADD COLUMN IF NOT EXISTS customs_eligible boolean,
  ADD COLUMN IF NOT EXISTS customs_category text,
  ADD COLUMN IF NOT EXISTS customs_notes text,
  ADD COLUMN IF NOT EXISTS customs_exclude boolean DEFAULT false;

COMMENT ON COLUMN cernita_entries.acquisition_year IS
  'Year item was acquired — used for 6-month ownership verification for Italian customs exemption';

COMMENT ON COLUMN cernita_entries.customs_eligible IS
  'Null = not assessed, true = qualifies for duty-free exemption, false = does not qualify';

COMMENT ON COLUMN cernita_entries.customs_category IS
  'Italian customs category: mobili, abbigliamento, libri, elettronica, strumenti_musicali, arte, cucina, sport, altri';

COMMENT ON COLUMN cernita_entries.customs_notes IS
  'Free-text notes for customs declaration (e.g. provenance, special circumstances)';

COMMENT ON COLUMN cernita_entries.customs_exclude IS
  'If true, item is excluded from the customs declaration even if KEEP-ITALY';

CREATE INDEX IF NOT EXISTS idx_cernita_entries_customs_category
  ON cernita_entries (customs_category)
  WHERE final_decision = 'KEEP-ITALY';
