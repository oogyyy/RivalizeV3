-- Utility Lineup Library
CREATE TABLE IF NOT EXISTS lineups (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID    NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by  UUID    NOT NULL REFERENCES auth.users(id),
  map         TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  type        TEXT    NOT NULL DEFAULT 'smoke', -- smoke | flash | molotov | he | custom
  notes       TEXT,
  canvas_data JSONB   NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lineups_select" ON lineups
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "lineups_insert" ON lineups
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "lineups_update" ON lineups
  FOR UPDATE USING (
    created_by = auth.uid()
    OR team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "lineups_delete" ON lineups
  FOR DELETE USING (
    created_by = auth.uid()
    OR team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS lineups_team_id_idx ON lineups(team_id);
CREATE INDEX IF NOT EXISTS lineups_map_idx     ON lineups(map);
