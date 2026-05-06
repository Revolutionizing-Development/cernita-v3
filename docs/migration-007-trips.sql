-- Migration 007: trips and suitcases (spec 007)
-- Run in Supabase → SQL Editor → New query → Run
-- Safe to re-run: all statements use IF NOT EXISTS / DO $$ BEGIN ... END $$

-- ── 1. Trips table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cernita_trips (
  id                      bigserial PRIMARY KEY,
  name                    text NOT NULL,
  name_it                 text,
  traveler_name           text NOT NULL,
  origin_location_id      bigint REFERENCES cernita_locations(id),
  destination_location_id bigint REFERENCES cernita_locations(id),
  departure_date          date,
  return_date             date,
  status                  text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','packing','executed','canceled')),
  executed_at             timestamptz,
  notes                   text,
  notes_it                text,
  created_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cernita_trips_status_date
  ON cernita_trips (status, departure_date);

ALTER TABLE cernita_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_access" ON cernita_trips;
CREATE POLICY "authenticated_access" ON cernita_trips
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 2. Extend cernita_boxes with suitcase fields ──────────────────────────────

ALTER TABLE cernita_boxes
  ADD COLUMN IF NOT EXISTS box_type text DEFAULT 'cardboard'
    CHECK (box_type IN ('cardboard','suitcase')),
  ADD COLUMN IF NOT EXISTS trip_id bigint REFERENCES cernita_trips(id),
  ADD COLUMN IF NOT EXISTS suitcase_class text
    CHECK (suitcase_class IS NULL OR suitcase_class IN ('checked','carry_on','personal_item')),
  ADD COLUMN IF NOT EXISTS weight_limit_lb numeric;

CREATE INDEX IF NOT EXISTS idx_cernita_boxes_trip
  ON cernita_boxes (trip_id);

-- Suitcases must have a trip and a class (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'suitcase_requires_trip'
      AND conrelid = 'cernita_boxes'::regclass
  ) THEN
    ALTER TABLE cernita_boxes
      ADD CONSTRAINT suitcase_requires_trip
        CHECK (box_type != 'suitcase' OR (trip_id IS NOT NULL AND suitcase_class IS NOT NULL));
  END IF;
END $$;

-- Back-fill box_type for existing rows (safe default)
UPDATE cernita_boxes SET box_type = 'cardboard' WHERE box_type IS NULL;
