-- Apply this to an existing Supabase database that already has supabase/schema.sql.
-- It replaces recursive team_members policies with SECURITY DEFINER helper checks.

CREATE OR REPLACE FUNCTION public.is_team_member(target_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = target_team_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(target_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = target_team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_creator(target_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams
    WHERE id = target_team_id
      AND created_by = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Team members can view teams" ON public.teams;
DROP POLICY IF EXISTS "Team owners and admins can update teams" ON public.teams;

DROP POLICY IF EXISTS "Team members can view membership" ON public.team_members;
DROP POLICY IF EXISTS "Owners and admins can manage members" ON public.team_members;
DROP POLICY IF EXISTS "Users can join teams (insert themselves)" ON public.team_members;
DROP POLICY IF EXISTS "Team creators can add themselves as owner" ON public.team_members;
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.team_members;
DROP POLICY IF EXISTS "Owners and admins can update members" ON public.team_members;
DROP POLICY IF EXISTS "Owners and admins can remove members" ON public.team_members;

DROP POLICY IF EXISTS "Team members can view demos" ON public.demos;
DROP POLICY IF EXISTS "Team members can upload demos" ON public.demos;
DROP POLICY IF EXISTS "Team members can update demos" ON public.demos;

DROP POLICY IF EXISTS "Team members can view folders" ON public.team_folders;
DROP POLICY IF EXISTS "Team members can manage folders" ON public.team_folders;

CREATE POLICY "Team members can view teams" ON public.teams
FOR SELECT USING (public.is_team_member(id));

CREATE POLICY "Team owners and admins can update teams" ON public.teams
FOR UPDATE USING (public.is_team_admin(id)) WITH CHECK (public.is_team_admin(id));

CREATE POLICY "Team members can view membership" ON public.team_members
FOR SELECT USING (auth.uid() = user_id OR public.is_team_member(team_id));

CREATE POLICY "Team creators can add themselves as owner" ON public.team_members
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND role = 'owner' AND public.is_team_creator(team_id)
);

CREATE POLICY "Owners and admins can add members" ON public.team_members
FOR INSERT WITH CHECK (
  public.is_team_admin(team_id) AND role IN ('admin', 'member')
);

CREATE POLICY "Owners and admins can update members" ON public.team_members
FOR UPDATE USING (public.is_team_admin(team_id)) WITH CHECK (public.is_team_admin(team_id));

CREATE POLICY "Owners and admins can remove members" ON public.team_members
FOR DELETE USING (public.is_team_admin(team_id));

CREATE POLICY "Team members can view demos" ON public.demos
FOR SELECT USING (public.is_team_member(team_id));

CREATE POLICY "Team members can upload demos" ON public.demos
FOR INSERT WITH CHECK (public.is_team_member(team_id));

CREATE POLICY "Team members can update demos" ON public.demos
FOR UPDATE USING (public.is_team_member(team_id)) WITH CHECK (public.is_team_member(team_id));

CREATE POLICY "Team members can view folders" ON public.team_folders
FOR SELECT USING (public.is_team_member(user_team_id));

CREATE POLICY "Team members can manage folders" ON public.team_folders
FOR ALL USING (public.is_team_member(user_team_id)) WITH CHECK (public.is_team_member(user_team_id));
