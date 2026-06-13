-- Egress reduction: compute the per-map T/CT win split for a team's self demos
-- entirely inside Postgres, returning only the small aggregated counts.
--
-- Previously the My Team dashboard pulled every demo's full parsed_data
-- (incl. the ~124 KB rounds[] array) just to derive this split client-side.
-- This function reads rounds in-DB and egresses only a handful of integers.
--
-- Side logic mirrors components/teams/MyTeamDashboard.tsx (computeStats):
--   our team label = the side opposite opponentSide
--   our side is T when: opponentSide='team2' AND round<=12, OR
--                       opponentSide='team1' AND round>12
CREATE OR REPLACE FUNCTION team_self_map_side_splits(p_team_id uuid)
RETURNS TABLE (
  map      text,
  t_wins   int,
  t_total  int,
  ct_wins  int,
  ct_total int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH rnds AS (
    SELECT
      COALESCE(d.parsed_data->'header'->>'map', d.map)   AS map,
      COALESCE(d.parsed_data->>'opponentSide', 'team2')  AS opp_side,
      d.parsed_data->'header'->>'team1'                  AS team1,
      d.parsed_data->'header'->>'team2'                  AS team2,
      (r->>'number')::int                                AS round_no,
      r->>'winner'                                       AS winner
    FROM demos d
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(d.parsed_data->'rounds') = 'array'
        THEN d.parsed_data->'rounds' ELSE '[]'::jsonb END
    ) AS r
    WHERE d.team_id   = p_team_id
      AND d.demo_type = 'self'
      AND d.status    = 'completed'
      AND d.parsed_data ? 'header'
  ), classified AS (
    SELECT
      map,
      CASE WHEN opp_side = 'team1' THEN team2 ELSE team1 END AS our_label,
      winner,
      CASE WHEN opp_side = 'team2' THEN round_no <= 12
                                   ELSE round_no >  12 END   AS our_side_is_t
    FROM rnds
    WHERE map IS NOT NULL AND winner IS NOT NULL
  )
  SELECT
    map,
    COUNT(*) FILTER (WHERE our_side_is_t      AND winner = our_label)::int AS t_wins,
    COUNT(*) FILTER (WHERE our_side_is_t)::int                             AS t_total,
    COUNT(*) FILTER (WHERE NOT our_side_is_t  AND winner = our_label)::int AS ct_wins,
    COUNT(*) FILTER (WHERE NOT our_side_is_t)::int                         AS ct_total
  FROM classified
  GROUP BY map;
$$;

GRANT EXECUTE ON FUNCTION team_self_map_side_splits(uuid) TO authenticated, service_role;
