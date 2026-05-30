CREATE TABLE IF NOT EXISTS playbooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  map         TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT 'Untitled Playbook',
  sections    JSONB NOT NULL DEFAULT '{}',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS playbooks_team_id_idx ON playbooks(team_id);
CREATE INDEX IF NOT EXISTS playbooks_created_by_idx ON playbooks(created_by);

ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_can_view_playbooks"
  ON playbooks FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "team_members_can_insert_playbooks"
  ON playbooks FOR INSERT
  WITH CHECK (is_team_member(team_id) AND auth.uid() = created_by);

CREATE POLICY "team_members_can_update_playbooks"
  ON playbooks FOR UPDATE
  USING (is_team_member(team_id));

CREATE POLICY "team_admins_can_delete_playbooks"
  ON playbooks FOR DELETE
  USING (is_team_admin(team_id));
