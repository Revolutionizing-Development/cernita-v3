-- Migration 010: rename box type 'cardboard' → 'plastic'
-- Run in Supabase → SQL Editor → New query → Run
-- Safe to re-run: UPDATE only affects rows with the old value

-- Step 1: Drop the existing CHECK constraint on box_type
ALTER TABLE cernita_boxes
  DROP CONSTRAINT IF EXISTS cernita_boxes_box_type_check;

-- Step 2: Add updated CHECK constraint allowing 'plastic' and 'suitcase'
ALTER TABLE cernita_boxes
  ADD CONSTRAINT cernita_boxes_box_type_check
  CHECK (box_type IN ('plastic', 'suitcase'));

-- Step 3: Migrate existing data — rename all 'cardboard' rows to 'plastic'
UPDATE cernita_boxes
  SET box_type = 'plastic'
  WHERE box_type = 'cardboard';
