-- Migration 019: fix box_type default from 'cardboard' to 'plastic'
-- Run in Supabase → SQL Editor → New query → Run
-- Safe to re-run: ALTER COLUMN SET DEFAULT is idempotent
--
-- Background: migration-007 added box_type with DEFAULT 'cardboard'.
-- Migration-010 updated the CHECK constraint to only allow 'plastic'
-- and 'suitcase', but did NOT update the DEFAULT. Any insert that
-- omits box_type gets the old default 'cardboard', which violates
-- the CHECK constraint.

ALTER TABLE cernita_boxes
  ALTER COLUMN box_type SET DEFAULT 'plastic';
