-- Fix SECURITY DEFINER function exposure via the REST API.
--
-- The previous REVOKE FROM anon, authenticated was a no-op because all grants
-- were held by PUBLIC (=X/postgres). This migration revokes from PUBLIC first,
-- then adds back the minimum grants needed:
--
--  * RLS helpers (is_team_member, is_team_admin, is_team_creator) need EXECUTE
--    for the `authenticated` role so row-level security policies can evaluate them.
--    They are NOT granted back to `anon` — tables using these helpers are not
--    intended to be accessed anonymously.
--
--  * handle_new_user, rls_auto_enable, set_demo_opponent_side are internal only;
--    service_role already holds an explicit EXECUTE grant and continues to work.

-- ── Step 1: strip the PUBLIC grant from all affected functions ────────────

REVOKE EXECUTE ON FUNCTION public.handle_new_user()                             FROM PUBLIC;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_demo_opponent_side(uuid, text)            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid)                         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid)                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_admin(uuid)                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_admin(uuid, uuid)                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_team_creator(uuid)                        FROM PUBLIC;

-- ── Step 2: re-grant only what RLS requires ───────────────────────────────
-- Authenticated users need EXECUTE on the team helper functions so that RLS
-- policies referencing them can be evaluated during queries.

GRANT EXECUTE ON FUNCTION public.is_team_member(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid, uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_creator(uuid)        TO authenticated;
