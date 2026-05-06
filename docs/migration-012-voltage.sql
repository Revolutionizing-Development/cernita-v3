-- Migration 012: Voltage incompatibility flag
-- Items with US 110V/60Hz power that won't work in Italy (220V/50Hz)

ALTER TABLE cernita_entries
  ADD COLUMN IF NOT EXISTS voltage_incompatible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN cernita_entries.voltage_incompatible IS
  'True if item uses US-only 110V power and is incompatible with Italian 220V/50Hz mains';
