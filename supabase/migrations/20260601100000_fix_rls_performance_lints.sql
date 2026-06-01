-- Fix Supabase performance lints:
-- 1. auth_rls_initplan: wrap auth.uid() with (select auth.uid()) so it evaluates
--    once per query instead of once per row.
-- 2. multiple_permissive_policies: consolidate duplicate SELECT/INSERT policies
--    on lineups, team_folders, and team_members.

-- ── user_settings ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view their own settings"   ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;

CREATE POLICY "Users can view their own settings" ON user_settings
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert their own settings" ON user_settings
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own settings" ON user_settings
  FOR UPDATE USING ((select auth.uid()) = user_id);

-- ── profiles ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING ((select auth.uid()) = id);

-- ── ai_sessions ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage their own AI sessions" ON ai_sessions;

CREATE POLICY "Users can manage their own AI sessions" ON ai_sessions
  FOR ALL USING ((select auth.uid()) = user_id);

-- ── teams ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can create teams"     ON teams;
DROP POLICY IF EXISTS "Team members can view teams"              ON teams;
DROP POLICY IF EXISTS "Team owners and admins can update teams"  ON teams;

CREATE POLICY "Authenticated users can create teams" ON teams
  FOR INSERT WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY "Team members can view teams" ON teams
  FOR SELECT USING (
    (select auth.uid()) IN (
      SELECT user_id FROM team_members WHERE team_id = teams.id
    )
  );

CREATE POLICY "Team owners and admins can update teams" ON teams
  FOR UPDATE USING (
    (select auth.uid()) IN (
      SELECT user_id FROM team_members
      WHERE team_id = teams.id
        AND role = ANY(ARRAY['owner', 'admin'])
    )
  );

-- ── team_members ──────────────────────────────────────────────────────────
-- Also consolidates "Users can join teams (insert themselves)" + team_members_insert
-- into a single INSERT policy (fixes multiple_permissive_policies).
DROP POLICY IF EXISTS "Users can join teams (insert themselves)" ON team_members;
DROP POLICY IF EXISTS "team_members_select" ON team_members;
DROP POLICY IF EXISTS "team_members_insert" ON team_members;
DROP POLICY IF EXISTS "team_members_update" ON team_members;
DROP POLICY IF EXISTS "team_members_delete" ON team_members;

CREATE POLICY "team_members_select" ON team_members
  FOR SELECT USING (is_team_member(team_id, (select auth.uid())));

CREATE POLICY "team_members_insert" ON team_members
  FOR INSERT WITH CHECK (
    ((select auth.uid()) = user_id)
    OR is_team_admin(team_id, (select auth.uid()))
  );

CREATE POLICY "team_members_update" ON team_members
  FOR UPDATE USING (is_team_admin(team_id, (select auth.uid())));

CREATE POLICY "team_members_delete" ON team_members
  FOR DELETE USING (is_team_admin(team_id, (select auth.uid())));

-- ── demos ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "demos_select" ON demos;
DROP POLICY IF EXISTS "demos_insert" ON demos;
DROP POLICY IF EXISTS "demos_update" ON demos;

CREATE POLICY "demos_select" ON demos
  FOR SELECT USING (is_team_member(team_id, (select auth.uid())));
CREATE POLICY "demos_insert" ON demos
  FOR INSERT WITH CHECK (is_team_member(team_id, (select auth.uid())));
CREATE POLICY "demos_update" ON demos
  FOR UPDATE USING (is_team_member(team_id, (select auth.uid())));

-- ── team_folders ──────────────────────────────────────────────────────────
-- Drops the redundant SELECT-only policy; the ALL policy already covers SELECT
-- (fixes multiple_permissive_policies). Also fixes auth_rls_initplan.
DROP POLICY IF EXISTS "Team members can manage folders" ON team_folders;
DROP POLICY IF EXISTS "Team members can view folders"   ON team_folders;

CREATE POLICY "Team members can manage folders" ON team_folders
  FOR ALL USING (
    (select auth.uid()) IN (
      SELECT user_id FROM team_members WHERE team_id = user_team_id
    )
  );

-- ── playbooks ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "team_members_can_insert_playbooks" ON playbooks;

CREATE POLICY "team_members_can_insert_playbooks" ON playbooks
  FOR INSERT WITH CHECK (
    is_team_member(team_id) AND (select auth.uid()) = created_by
  );

-- ── faceit_elo_snapshots ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "elo_select_own" ON faceit_elo_snapshots;
DROP POLICY IF EXISTS "elo_insert_own" ON faceit_elo_snapshots;

CREATE POLICY "elo_select_own" ON faceit_elo_snapshots
  FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "elo_insert_own" ON faceit_elo_snapshots
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- ── lineups ───────────────────────────────────────────────────────────────
-- Merges public_lineups_read + team_members_lineups into a single SELECT policy
-- (fixes multiple_permissive_policies). Splits ALL into per-command policies so
-- the public read condition only applies to SELECT (fixes auth_rls_initplan).
DROP POLICY IF EXISTS "team_members_lineups" ON lineups;
DROP POLICY IF EXISTS "public_lineups_read"  ON lineups;

CREATE POLICY "lineups_select" ON lineups
  FOR SELECT USING (
    (is_public = true)
    OR (team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = (select auth.uid())
    ))
  );

CREATE POLICY "lineups_insert" ON lineups
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "lineups_update" ON lineups
  FOR UPDATE USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "lineups_delete" ON lineups
  FOR DELETE USING (
    team_id IN (
      SELECT team_id FROM team_members WHERE user_id = (select auth.uid())
    )
  );

-- ── team_invitations ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_view_own_invitations" ON team_invitations;
DROP POLICY IF EXISTS "authenticated_can_insert"   ON team_invitations;
DROP POLICY IF EXISTS "invitee_can_update"          ON team_invitations;

CREATE POLICY "users_view_own_invitations" ON team_invitations
  FOR SELECT USING (
    invitee_id = (select auth.uid()) OR inviter_id = (select auth.uid())
  );
CREATE POLICY "authenticated_can_insert" ON team_invitations
  FOR INSERT WITH CHECK (inviter_id = (select auth.uid()));
CREATE POLICY "invitee_can_update" ON team_invitations
  FOR UPDATE USING (invitee_id = (select auth.uid()));

-- ── friendships ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_see_own_friendships"   ON friendships;
DROP POLICY IF EXISTS "users_send_friend_request"   ON friendships;
DROP POLICY IF EXISTS "addressee_update_friendship" ON friendships;
DROP POLICY IF EXISTS "either_party_delete"         ON friendships;

CREATE POLICY "users_see_own_friendships" ON friendships
  FOR SELECT USING (
    (select auth.uid()) = requester_id OR (select auth.uid()) = addressee_id
  );
CREATE POLICY "users_send_friend_request" ON friendships
  FOR INSERT WITH CHECK ((select auth.uid()) = requester_id);
CREATE POLICY "addressee_update_friendship" ON friendships
  FOR UPDATE USING ((select auth.uid()) = addressee_id);
CREATE POLICY "either_party_delete" ON friendships
  FOR DELETE USING (
    (select auth.uid()) = requester_id OR (select auth.uid()) = addressee_id
  );
