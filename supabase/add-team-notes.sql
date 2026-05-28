-- Team Notes: shared notes attached to a team, optionally scoped to a folder/demo/round
CREATE TABLE IF NOT EXISTS team_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  -- Optional scoping
  folder_id UUID REFERENCES team_folders(id) ON DELETE CASCADE,
  demo_id UUID REFERENCES demos(id) ON DELETE CASCADE,
  round_number INTEGER,
  -- Tagging
  tags TEXT[] DEFAULT '{}',
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_notes_team_id_idx ON team_notes(team_id);
CREATE INDEX IF NOT EXISTS team_notes_folder_id_idx ON team_notes(folder_id);
CREATE INDEX IF NOT EXISTS team_notes_demo_id_idx ON team_notes(demo_id);

ALTER TABLE team_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view notes" ON team_notes
  FOR SELECT USING (is_team_member(team_id));

CREATE POLICY "Team members can create notes" ON team_notes
  FOR INSERT WITH CHECK (is_team_member(team_id) AND auth.uid() = created_by);

CREATE POLICY "Note author or admin can update notes" ON team_notes
  FOR UPDATE USING (auth.uid() = created_by OR is_team_admin(team_id));

CREATE POLICY "Note author or admin can delete notes" ON team_notes
  FOR DELETE USING (auth.uid() = created_by OR is_team_admin(team_id));

CREATE TRIGGER team_notes_updated_at
  BEFORE UPDATE ON team_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
