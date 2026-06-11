-- Security advisor cleanup
--
-- Addresses Supabase database linter findings:
--   * team_stats_cache had RLS enabled but no policy (table was unreadable
--     except via the service role)
--   * three functions had a mutable search_path
--   * three SECURITY DEFINER functions were callable directly via PostgREST
--     by anon/authenticated even though every caller uses the service role

-- ── team_stats_cache read policy ──────────────────────────────────────────────
-- Aggregate, non-sensitive team stats. Team members may read their team's row;
-- writes happen only via refresh_team_stats() under the service role.
drop policy if exists "Team members read team stats" on team_stats_cache;
create policy "Team members read team stats"
  on team_stats_cache for select
  using (private.is_team_member(team_id, (select auth.uid())));

-- ── Pin search_path on flagged functions (no behaviour change) ────────────────
alter function public.get_team_plan(p_team_id uuid)            set search_path = public;
alter function public.increment_team_demo_count(p_team_id uuid) set search_path = public;
alter function public.get_platform_stats()                     set search_path = public;

-- ── Restrict SECURITY DEFINER RPCs to the service role ────────────────────────
-- All callers (retrieval.ts, parse-and-save.ts, the stats and refresh-stats API
-- routes) invoke these through the service-role admin client. Functions grant
-- EXECUTE to PUBLIC by default, so we revoke that (which also covers anon and
-- authenticated) and re-grant only the service role, taking them off the
-- public PostgREST API entirely.
revoke execute on function public.get_platform_stats() from public, anon, authenticated;
grant  execute on function public.get_platform_stats() to service_role;

revoke execute on function public.refresh_team_stats(uuid) from public, anon, authenticated;
grant  execute on function public.refresh_team_stats(uuid) to service_role;

revoke execute on function public.match_cs2_knowledge(public.vector, text, uuid, integer, double precision)
  from public, anon, authenticated;
grant  execute on function public.match_cs2_knowledge(public.vector, text, uuid, integer, double precision)
  to service_role;
