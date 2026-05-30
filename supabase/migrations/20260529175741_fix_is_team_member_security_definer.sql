CREATE OR REPLACE FUNCTION public.is_team_member(target_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = target_team_id AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(target_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = target_team_id AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
END;
$$;
