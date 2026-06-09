-- Public function to aggregate platform-wide stats for the landing page.
-- SECURITY DEFINER lets it run as the function owner, bypassing RLS.
-- Grant execute to anon so the public API route can call it without service-role.
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_teams          bigint;
  v_demos          bigint;
  v_rounds         bigint;
  v_parse_time_avg float;
BEGIN
  SELECT COUNT(*) INTO v_teams FROM teams;

  SELECT COUNT(*) INTO v_demos
  FROM demos WHERE status = 'completed';

  SELECT COALESCE(SUM(
    COALESCE((parsed_data->'header'->>'score_team1')::int, 0) +
    COALESCE((parsed_data->'header'->>'score_team2')::int, 0)
  ), 0) INTO v_rounds
  FROM demos WHERE status = 'completed';

  SELECT COALESCE(AVG(
    EXTRACT(EPOCH FROM (parsed_at - processing_started_at))
  ), NULL) INTO v_parse_time_avg
  FROM demos
  WHERE status = 'completed'
    AND parsed_at IS NOT NULL
    AND processing_started_at IS NOT NULL;

  RETURN json_build_object(
    'teams',                 v_teams,
    'demos',                 v_demos,
    'rounds',                v_rounds,
    'parse_time_avg_seconds', v_parse_time_avg
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_platform_stats() TO anon, authenticated;
