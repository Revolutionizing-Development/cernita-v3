-- Migration 008: shipping restrictions + box storage requirements
-- Run in Supabase → SQL Editor → New query → Run
-- Safe to re-run: all statements use IF NOT EXISTS / DO $$ BEGIN ... END $$

-- ── 1. Shipping restriction fields on entries ─────────────────────────────────
--
-- shipping_restriction: AI-assessed international shipping status
--   'none'       — no known restrictions, ship normally
--   'restricted' — can ship with special handling / documentation
--   'prohibited' — cannot ship internationally by standard means
--
-- shipping_restriction_note: plain-language explanation + alternatives

ALTER TABLE cernita_entries
  ADD COLUMN IF NOT EXISTS shipping_restriction text
    CHECK (shipping_restriction IS NULL OR
           shipping_restriction IN ('none', 'restricted', 'prohibited')),
  ADD COLUMN IF NOT EXISTS shipping_restriction_note      text,
  ADD COLUMN IF NOT EXISTS shipping_restriction_note_it   text;

CREATE INDEX IF NOT EXISTS idx_cernita_entries_shipping_restriction
  ON cernita_entries (shipping_restriction)
  WHERE shipping_restriction IN ('restricted', 'prohibited');

-- ── 2. Storage requirement on boxes ──────────────────────────────────────────
--
-- storage_requirement: physical storage conditions needed for this box
--   'climate_controlled' — books, art, electronics, leather, instruments
--   'standard'           — default indoor storage
--   'garage_ok'          — tools, pots & pans, outdoor gear, metal items

ALTER TABLE cernita_boxes
  ADD COLUMN IF NOT EXISTS storage_requirement text DEFAULT 'standard'
    CHECK (storage_requirement IS NULL OR
           storage_requirement IN ('climate_controlled', 'standard', 'garage_ok'));

-- Back-fill existing boxes with 'standard'
UPDATE cernita_boxes SET storage_requirement = 'standard' WHERE storage_requirement IS NULL;
