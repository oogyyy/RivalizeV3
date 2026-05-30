CREATE OR REPLACE FUNCTION is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION is_team_admin(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id AND role = ANY(ARRAY['owner', 'admin']));
$$;

DROP POLICY IF EXISTS "Team members can view membership" ON team_members;
DROP POLICY IF EXISTS "Owners and admins can manage members" ON team_members;

CREATE POLICY "team_members_select" ON team_members FOR SELECT USING (is_team_member(team_id, auth.uid()));
CREATE POLICY "team_members_insert" ON team_members FOR INSERT WITH CHECK (is_team_admin(team_id, auth.uid()));
CREATE POLICY "team_members_update" ON team_members FOR UPDATE USING (is_team_admin(team_id, auth.uid()));
CREATE POLICY "team_members_delete" ON team_members FOR DELETE USING (is_team_admin(team_id, auth.uid()));
