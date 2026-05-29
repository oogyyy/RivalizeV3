CREATE TABLE IF NOT EXISTS team_invitations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  inviter_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, invitee_id)
);

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_invitations" ON team_invitations
  FOR SELECT USING (invitee_id = auth.uid() OR inviter_id = auth.uid());

CREATE POLICY "authenticated_can_insert" ON team_invitations
  FOR INSERT WITH CHECK (inviter_id = auth.uid());

CREATE POLICY "invitee_can_update" ON team_invitations
  FOR UPDATE USING (invitee_id = auth.uid());
