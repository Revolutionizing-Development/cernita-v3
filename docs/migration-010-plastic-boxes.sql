-- Migration 010: rename box type 'cardboard' → 'plastic'
-- Run in Supabase → SQL Editor → New query → Run
-- Safe to re-run: UPDATE and DROP CONSTRAINT IF EXISTS are idempotent

-- Step 1: Drop the existing CHECK constraint on box_type
ALTER TABLE cernita_boxes
  DROP CONSTRAINT IF EXISTS cernita_boxes_box_type_check;

-- Step 2: Migrate existing data BEFORE adding the new constraint
--         (adding constraint first would reject the old 'cardboard' values)
UPDATE cernita_boxes
  SET box_type = 'plastic'
  WHERE box_type = 'cardboard';

-- Step 3: Add updated CHECK constraint allowing 'plastic' and 'suitcase'
ALTER TABLE cernita_boxes
  ADD CONSTRAINT cernita_boxes_box_type_check
  CHECK (box_type IN ('plastic', 'suitcase'));
