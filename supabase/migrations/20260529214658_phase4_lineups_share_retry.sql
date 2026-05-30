CREATE TABLE IF NOT EXISTS lineups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  map           TEXT NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'smoke',
  notes         TEXT NOT NULL DEFAULT '',
  canvas_data   JSONB NOT NULL DEFAULT '[]',
  is_public     BOOLEAN NOT NULL DEFAULT false,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lineups_team_id  ON lineups(team_id);
CREATE INDEX IF NOT EXISTS idx_lineups_map       ON lineups(map);
CREATE INDEX IF NOT EXISTS idx_lineups_is_public ON lineups(is_public) WHERE is_public = true;

ALTER TABLE lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_lineups" ON lineups
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "public_lineups_read" ON lineups
  FOR SELECT USING (is_public = true);

ALTER TABLE demos ADD COLUMN IF NOT EXISTS share_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_demos_share_id ON demos(share_id) WHERE share_id IS NOT NULL;

ALTER TABLE demos ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
