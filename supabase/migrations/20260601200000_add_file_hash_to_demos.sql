ALTER TABLE demos ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Index for fast per-team duplicate lookups (only non-null hashes)
CREATE INDEX IF NOT EXISTS demos_team_file_hash_idx
  ON demos (team_id, file_hash)
  WHERE file_hash IS NOT NULL;
