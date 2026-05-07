-- Migration 016: Phased item flow (spec 016)
-- Renames KEEP-ITALY → SHIP-ITALY, removes KEEP-US, adds CONSUME decision,
-- adds action_phase, override_tags, italy_confirmed, and colorado_placement.
--
-- Run this in the Supabase SQL Editor AFTER deploying the code update.
-- The code handles both old and new values gracefully during rollout.

-- 0. Drop the old CHECK constraint on final_decision so we can rename values.
--    The constraint name may vary — drop all check constraints on this column.
ALTER TABLE cernita_entries DROP CONSTRAINT IF EXISTS cernita_entries_final_decision_check;
ALTER TABLE cernita_entries DROP CONSTRAINT IF EXISTS entries_final_decision_check;

-- 1. Rename KEEP-ITALY → SHIP-ITALY in entries
UPDATE cernita_entries
  SET final_decision = 'SHIP-ITALY'
  WHERE final_decision = 'KEEP-ITALY';

-- 2. Migrate KEEP-US → SELL with phase COLORADO (conservative default)
-- These items are flagged for user review
UPDATE cernita_entries
  SET final_decision = 'SELL',
      override_reason = COALESCE(override_reason || ' | ', '') || '[AUTO-MIGRATED from KEEP-US — please review]'
  WHERE final_decision = 'KEEP-US';

-- 2b. Also handle KEEP-TEXAS (legacy alias for KEEP-US)
UPDATE cernita_entries
  SET final_decision = 'SELL',
      override_reason = COALESCE(override_reason || ' | ', '') || '[AUTO-MIGRATED from KEEP-TEXAS — please review]'
  WHERE final_decision = 'KEEP-TEXAS';

-- 2c. Re-add CHECK constraint with the new valid decision values
ALTER TABLE cernita_entries
  ADD CONSTRAINT cernita_entries_final_decision_check
  CHECK (final_decision IN ('SHIP-ITALY', 'SELL', 'DONATE', 'DISPOSE', 'GIVE-FAMILY', 'CONSUME', 'NEEDS-HUMAN'));

-- 3. Add action_phase column
ALTER TABLE cernita_entries
  ADD COLUMN IF NOT EXISTS action_phase text
  CHECK (action_phase IN ('NOW', 'COLORADO'));

-- 4. Set default phases for existing SELL/DONATE entries
UPDATE cernita_entries SET action_phase = 'NOW' WHERE final_decision = 'SELL' AND action_phase IS NULL;
UPDATE cernita_entries SET action_phase = 'NOW' WHERE final_decision = 'DONATE' AND action_phase IS NULL;

-- 5. Add override_tags column (JSON array of tag strings)
ALTER TABLE cernita_entries
  ADD COLUMN IF NOT EXISTS override_tags jsonb DEFAULT NULL;

-- 6. Add italy_confirmed for active-use re-evaluation gate
ALTER TABLE cernita_entries
  ADD COLUMN IF NOT EXISTS italy_confirmed boolean DEFAULT false;

-- 7. Add colorado_placement to boxes
ALTER TABLE cernita_boxes
  ADD COLUMN IF NOT EXISTS colorado_placement text
  CHECK (colorado_placement IN ('ACTIVE-USE', 'HOUSE-STORAGE', 'GARAGE'));

-- 8. Drop old CHECK constraint on box destinations (if any)
ALTER TABLE cernita_boxes DROP CONSTRAINT IF EXISTS cernita_boxes_destination_check;
ALTER TABLE cernita_boxes DROP CONSTRAINT IF EXISTS boxes_destination_check;

-- 8b. Rename KEEP-ITALY → SHIP-ITALY in box destinations
UPDATE cernita_boxes
  SET destination = 'SHIP-ITALY'
  WHERE destination = 'KEEP-ITALY';

-- 9. Migrate KEEP-US / KEEP-TEXAS boxes → SELL (flagged for review)
UPDATE cernita_boxes
  SET destination = 'SELL',
      notes = COALESCE(notes || ' | ', '') || '[AUTO-MIGRATED from KEEP-US — review contents]'
  WHERE destination IN ('KEEP-US', 'KEEP-TEXAS');

-- 9b. Re-add CHECK constraint with new valid destination values
ALTER TABLE cernita_boxes
  ADD CONSTRAINT cernita_boxes_destination_check
  CHECK (destination IN ('SHIP-ITALY', 'SELL', 'DONATE', 'DISPOSE', 'GIVE-FAMILY', 'CONSUME', 'NEEDS-HUMAN'));

-- 10. Rebuild customs index for new decision name
DROP INDEX IF EXISTS idx_cernita_entries_customs_category;
CREATE INDEX IF NOT EXISTS idx_cernita_entries_customs_category
  ON cernita_entries (customs_category)
  WHERE final_decision = 'SHIP-ITALY';

-- 11. Index for phase-based queries
CREATE INDEX IF NOT EXISTS idx_cernita_entries_action_phase
  ON cernita_entries (action_phase)
  WHERE action_phase IS NOT NULL;
