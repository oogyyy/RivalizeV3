-- Fix infinite recursion in team_members RLS policies.
--
-- The SECURITY DEFINER functions (is_team_member, is_team_admin) query
-- team_members internally. Without SET LOCAL row_security = off they still
-- trigger RLS evaluation on that table, which calls back into the same
-- functions — infinite recursion.
--
-- Apply this once in your Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.is_team_member(target_team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SET LOCAL row_security = off;
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = target_team_id
      AND user_id = auth.uid()
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(target_team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SET LOCAL row_security = off;
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = target_team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_team_creator(target_team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SET LOCAL row_security = off;
  SELECT EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = target_team_id
      AND created_by = auth.uid()
  ) INTO result;
  RETURN result;
END;
$$;
