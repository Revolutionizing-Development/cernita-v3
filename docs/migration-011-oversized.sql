-- Migration 011: oversized items
-- Run in Supabase → SQL Editor → New query → Run
-- Safe to re-run: uses IF NOT EXISTS

-- Items that physically cannot fit in a standard moving box (rugs, furniture,
-- large artwork, bicycles, etc.) — tracked for cost estimation but never
-- assigned to a box. Defaults to false so existing rows are unaffected.

ALTER TABLE cernita_entries
  ADD COLUMN IF NOT EXISTS oversized boolean NOT NULL DEFAULT false;
