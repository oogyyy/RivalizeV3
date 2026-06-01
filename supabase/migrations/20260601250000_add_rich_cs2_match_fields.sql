-- Add GC-sourced match data fields to cs2_matches
ALTER TABLE cs2_matches
  ADD COLUMN IF NOT EXISTS map          TEXT,
  ADD COLUMN IF NOT EXISTS score_ct     INTEGER,
  ADD COLUMN IF NOT EXISTS score_t      INTEGER,
  ADD COLUMN IF NOT EXISTS match_time   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS match_result INTEGER,
  ADD COLUMN IF NOT EXISTS demo_url     TEXT;
