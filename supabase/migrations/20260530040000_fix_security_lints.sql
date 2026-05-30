-- ── 1. Fix mutable search_path on trigger/utility functions ──────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_friendships_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_demo_opponent_side(p_demo_id uuid, p_opponent_side text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE demos
  SET parsed_data = COALESCE(parsed_data, '{}'::jsonb) || jsonb_build_object('opponentSide', p_opponent_side)
  WHERE id = p_demo_id;
$$;

-- ── 2. Revoke public EXECUTE on SECURITY DEFINER functions ───────────────────
-- These are internal helpers (RLS policies, triggers) — not public RPC endpoints.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_demo_opponent_side(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_admin(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_creator(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_admin(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

-- ── 3. Remove overly broad SELECT policies on public storage buckets ──────────
-- Public buckets serve files by URL directly — no RLS SELECT policy needed.
-- These policies allowed any client to LIST all files in the bucket.

DROP POLICY IF EXISTS "Avatars are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Team logos are publicly viewable" ON storage.objects;
