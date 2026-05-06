-- Migration 009: item model identification
-- Run in Supabase → SQL Editor → New query → Run
-- Safe to re-run: uses IF NOT EXISTS

-- AI-identified brand + model string for pricing accuracy
-- e.g. "DeWalt DCS570B 7-1/4 in. Circular Saw"
--      "KitchenAid KSM150PSER Artisan 5-Qt Stand Mixer"
-- Null for items with no meaningful model (generic goods, handmade items)

ALTER TABLE cernita_entries
  ADD COLUMN IF NOT EXISTS item_model text;
