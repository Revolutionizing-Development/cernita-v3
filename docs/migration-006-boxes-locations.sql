-- Migration 006: physical location tracking (spec 006)
-- Run this once in Supabase → SQL Editor → New query → Run
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING

-- ── 1. Locations ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cernita_locations (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  name_it     text,
  is_default  boolean DEFAULT false,
  sort_order  integer DEFAULT 100,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cernita_locations_sort
  ON cernita_locations (sort_order);

ALTER TABLE cernita_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_access" ON cernita_locations;
CREATE POLICY "authenticated_access" ON cernita_locations
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Default location seed (idempotent via ON CONFLICT DO NOTHING on unique name)
INSERT INTO cernita_locations (name, name_it, is_default, sort_order) VALUES
  ('Galesburg house',     'Casa di Galesburg',       true,  10),
  ('Galesburg storage',   'Magazzino di Galesburg',  true,  20),
  ('Colorado Springs',    'Colorado Springs',         true,  30),
  ('In transit',          'In transito',              true,  40),
  ('Italy port',          'Porto italiano',           true,  50),
  ('Italy house',         'Casa in Italia',           true,  60),
  ('Sold',                'Venduto',                  true,  70),
  ('Donated',             'Donato',                   true,  80),
  ('Disposed',            'Smaltito',                 true,  90)
ON CONFLICT (name) DO NOTHING;

-- ── 2. Boxes ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cernita_boxes (
  id                  bigserial PRIMARY KEY,
  box_number          text NOT NULL UNIQUE,
  destination         text NOT NULL,
  current_location_id bigint REFERENCES cernita_locations(id),
  notes               text,
  notes_it            text,
  closed_at           timestamptz,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cernita_boxes_location
  ON cernita_boxes (current_location_id);

ALTER TABLE cernita_boxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_access" ON cernita_boxes;
CREATE POLICY "authenticated_access" ON cernita_boxes
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 3. Foreign keys on cernita_entries ────────────────────────────────────────
-- box_id and current_location_id columns already exist (nullable, from spec 011)
-- These add the FK constraints now that the referenced tables exist.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_entries_box'
      AND table_name = 'cernita_entries'
  ) THEN
    ALTER TABLE cernita_entries
      ADD CONSTRAINT fk_entries_box
      FOREIGN KEY (box_id) REFERENCES cernita_boxes(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_entries_location'
      AND table_name = 'cernita_entries'
  ) THEN
    ALTER TABLE cernita_entries
      ADD CONSTRAINT fk_entries_location
      FOREIGN KEY (current_location_id) REFERENCES cernita_locations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 4. Also update cernita_entries CHECK constraint to accept KEEP-US ─────────
-- (replaces KEEP-TEXAS from spec 011 original schema if not already done)

ALTER TABLE cernita_entries
  DROP CONSTRAINT IF EXISTS cernita_entries_final_decision_check;

ALTER TABLE cernita_entries
  ADD CONSTRAINT cernita_entries_final_decision_check
  CHECK (final_decision IN (
    'KEEP-ITALY','KEEP-US','SELL','DONATE','DISPOSE','GIVE-FAMILY','NEEDS-HUMAN'
  ));
