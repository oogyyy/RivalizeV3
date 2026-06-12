CREATE TABLE team_email_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, email)
);
CREATE INDEX ON team_email_invites(token);
CREATE INDEX ON team_email_invites(team_id);

-- RLS
ALTER TABLE team_email_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team members can view invites" ON team_email_invites FOR SELECT USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_id = team_email_invites.team_id AND user_id = auth.uid())
);

CREATE POLICY "owner/admin can insert invites" ON team_email_invites FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM team_members WHERE team_id = team_email_invites.team_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
);

CREATE POLICY "owner/admin can delete invites" ON team_email_invites FOR DELETE USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_id = team_email_invites.team_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
);
