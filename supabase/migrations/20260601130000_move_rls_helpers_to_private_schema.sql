-- Move RLS helper functions to a private schema that is not exposed by
-- PostgREST, so authenticated users can no longer call them as RPC endpoints
-- while RLS policies that reference them continue to work.
--
-- PostgREST only exposes functions in schemas listed under "Exposed schemas"
-- (default: public only), so anything in `private` is invisible to the REST API.

-- ── 1. Private schema ─────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- ── 2. Recreate helper functions in private schema ────────────────────────

-- 2-arg variants (called from policies that pass auth.uid() explicitly)
CREATE OR REPLACE FUNCTION private.is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_team_admin(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = p_user_id
      AND role = ANY(ARRAY['owner', 'admin'])
  );
$$;

-- 1-arg variants (used in playbooks policies; call auth.uid() internally)
CREATE OR REPLACE FUNCTION private.is_team_member(target_team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = target_team_id AND user_id = (select auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION private.is_team_admin(target_team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = target_team_id AND user_id = (select auth.uid())
      AND role = ANY(ARRAY['owner', 'admin'])
  );
$$;

CREATE OR REPLACE FUNCTION private.is_team_creator(target_team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM teams
    WHERE id = target_team_id AND created_by = (select auth.uid())
  );
$$;

-- Grant EXECUTE on the private functions to authenticated (needed for RLS
-- evaluation). anon is intentionally excluded — tables using these helpers
-- should not be accessible to unauthenticated users.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

-- ── 3. Update RLS policies to call private schema functions ───────────────

-- team_members
DROP POLICY IF EXISTS "team_members_select" ON team_members;
DROP POLICY IF EXISTS "team_members_insert" ON team_members;
DROP POLICY IF EXISTS "team_members_update" ON team_members;
DROP POLICY IF EXISTS "team_members_delete" ON team_members;

CREATE POLICY "team_members_select" ON team_members
  FOR SELECT USING (private.is_team_member(team_id, (select auth.uid())));

CREATE POLICY "team_members_insert" ON team_members
  FOR INSERT WITH CHECK (
    ((select auth.uid()) = user_id)
    OR private.is_team_admin(team_id, (select auth.uid()))
  );

CREATE POLICY "team_members_update" ON team_members
  FOR UPDATE USING (private.is_team_admin(team_id, (select auth.uid())));

CREATE POLICY "team_members_delete" ON team_members
  FOR DELETE USING (private.is_team_admin(team_id, (select auth.uid())));

-- demos
DROP POLICY IF EXISTS "demos_select" ON demos;
DROP POLICY IF EXISTS "demos_insert" ON demos;
DROP POLICY IF EXISTS "demos_update" ON demos;

CREATE POLICY "demos_select" ON demos
  FOR SELECT USING (private.is_team_member(team_id, (select auth.uid())));

CREATE POLICY "demos_insert" ON demos
  FOR INSERT WITH CHECK (private.is_team_member(team_id, (select auth.uid())));

CREATE POLICY "demos_update" ON demos
  FOR UPDATE USING (private.is_team_member(team_id, (select auth.uid())));

-- playbooks
DROP POLICY IF EXISTS "team_members_can_view_playbooks"   ON playbooks;
DROP POLICY IF EXISTS "team_members_can_insert_playbooks" ON playbooks;
DROP POLICY IF EXISTS "team_members_can_update_playbooks" ON playbooks;
DROP POLICY IF EXISTS "team_admins_can_delete_playbooks"  ON playbooks;

CREATE POLICY "team_members_can_view_playbooks" ON playbooks
  FOR SELECT USING (private.is_team_member(team_id));

CREATE POLICY "team_members_can_insert_playbooks" ON playbooks
  FOR INSERT WITH CHECK (
    private.is_team_member(team_id) AND (select auth.uid()) = created_by
  );

CREATE POLICY "team_members_can_update_playbooks" ON playbooks
  FOR UPDATE USING (private.is_team_member(team_id));

CREATE POLICY "team_admins_can_delete_playbooks" ON playbooks
  FOR DELETE USING (private.is_team_admin(team_id));

-- ── 4. Revoke EXECUTE from authenticated on the public versions ───────────
-- The public functions remain (service_role still has EXECUTE for any internal
-- use), but authenticated users can no longer call them as REST RPC endpoints.

REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid)       FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_admin(uuid, uuid)  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_admin(uuid)        FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_creator(uuid)      FROM authenticated;
