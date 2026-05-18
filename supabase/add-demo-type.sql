-- Migration: add demo_type column to demos table for strict data isolation
-- demo_type = 'opponent' : uploaded via the Opponents flow (scouting an opposing team)
-- demo_type = 'self'     : uploaded via the My Team flow (self-analysis)
--
-- All existing demos default to 'opponent' to preserve backward compatibility
-- with the Opponent folder pages.

ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS demo_type TEXT NOT NULL DEFAULT 'opponent'
    CHECK (demo_type IN ('opponent', 'self'));

-- Index to speed up the per-page filtered queries
CREATE INDEX IF NOT EXISTS demos_demo_type_idx ON demos(demo_type);
