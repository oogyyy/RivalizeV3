ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS teams_is_personal_created_by_idx
  ON teams (created_by)
  WHERE is_personal = true;
