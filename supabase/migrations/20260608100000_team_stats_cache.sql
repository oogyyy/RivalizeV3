-- Phase 3: Write-time team stats cache
-- Replaces the expensive read-time JS aggregation over 1000 demos + parsed_data.
-- Refreshed by refresh_team_stats() after every successful demo parse.

CREATE TABLE IF NOT EXISTS team_stats_cache (
  team_id       UUID    PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  total_matches INTEGER NOT NULL DEFAULT 0,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  draws         INTEGER NOT NULL DEFAULT 0,
  win_rate      NUMERIC(6, 4) NOT NULL DEFAULT 0,   -- 0.0000–1.0000
  avg_rating    NUMERIC(6, 3) NOT NULL DEFAULT 0,
  avg_adr       NUMERIC(7, 2) NOT NULL DEFAULT 0,
  entry_rate    NUMERIC(6, 4) NOT NULL DEFAULT 0,   -- entry_kills / rounds_played
  clutch_rate   NUMERIC(6, 4) NOT NULL DEFAULT 0,   -- clutch_wins / clutch_attempts
  maps_played   JSONB         NOT NULL DEFAULT '{}', -- { "de_mirage": 5, ... }
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE team_stats_cache IS
  'Pre-aggregated team stats refreshed write-time after each demo parse. '
  'Read by the team dashboard instead of scanning up to 1000 demos with JSONB.';

CREATE INDEX IF NOT EXISTS team_stats_cache_updated_idx ON team_stats_cache(updated_at DESC);

-- Helper index for the refresh function (already exists in most setups, safe with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS demos_team_status_type_parsed_idx
  ON demos(team_id, status, demo_type)
  WHERE status = 'completed' AND demo_type = 'opponent';

-- ─────────────────────────────────────────────────────────────────────────────
-- refresh_team_stats(p_team_id)
--
-- Aggregates from demos.parsed_data JSONB and upserts team_stats_cache.
-- Called write-time (after each demo is parsed) so reads are always instant.
-- SECURITY DEFINER to run with elevated privileges regardless of caller's RLS.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_team_stats(p_team_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total       INTEGER := 0;
  v_wins        INTEGER := 0;
  v_draws       INTEGER := 0;
  v_losses      INTEGER := 0;
  v_win_rate    NUMERIC := 0;
  v_avg_rating  NUMERIC := 0;
  v_avg_adr     NUMERIC := 0;
  v_entry_rate  NUMERIC := 0;
  v_clutch_rate NUMERIC := 0;
  v_maps        JSONB   := '{}'::JSONB;
BEGIN
  -- ── Win/loss/draw record ──────────────────────────────────────────────────
  -- opponentSide = 'team1'  →  opponent is team1, WE are team2  →  we win if score_team2 > score_team1
  -- opponentSide = 'team2'  →  opponent is team2, WE are team1  →  we win if score_team1 > score_team2
  -- Default (NULL)          →  treat as 'team2'
  SELECT
    COALESCE(COUNT(*), 0)::int,
    COALESCE(COUNT(*) FILTER (WHERE
      CASE COALESCE(parsed_data->>'opponentSide', 'team2')
        WHEN 'team1'
          THEN (parsed_data->'header'->>'score_team2')::int
               > (parsed_data->'header'->>'score_team1')::int
        ELSE
          (parsed_data->'header'->>'score_team1')::int
          > (parsed_data->'header'->>'score_team2')::int
      END
    ), 0)::int,
    COALESCE(COUNT(*) FILTER (WHERE
      (parsed_data->'header'->>'score_team1')::int
      = (parsed_data->'header'->>'score_team2')::int
    ), 0)::int
  INTO v_total, v_wins, v_draws
  FROM demos
  WHERE team_id   = p_team_id
    AND status    = 'completed'
    AND demo_type = 'opponent'
    AND parsed_data IS NOT NULL
    AND parsed_data ? 'header';

  v_losses   := GREATEST(v_total - v_wins - v_draws, 0);
  v_win_rate := CASE WHEN v_total > 0 THEN v_wins::numeric / v_total ELSE 0 END;

  -- ── Map histogram ─────────────────────────────────────────────────────────
  SELECT COALESCE(jsonb_object_agg(map, cnt), '{}'::jsonb)
  INTO v_maps
  FROM (
    SELECT map, COUNT(*)::int AS cnt
    FROM demos
    WHERE team_id   = p_team_id
      AND status    = 'completed'
      AND demo_type = 'opponent'
      AND map IS NOT NULL
      AND map <> ''
    GROUP BY map
  ) m;

  -- ── Opponent player stats (from JSONB, Phase 2 fields optional) ───────────
  -- LATERAL over players[] filters to opponent-side players only.
  -- Phase 2 fields (entry_kills, clutch_wins/attempts) may be absent on old demos;
  -- COALESCE(..., 0) handles that gracefully.
  SELECT
    COALESCE(ROUND(AVG((p->>'rating')::numeric),           3), 0),
    COALESCE(ROUND(AVG((p->>'adr')::numeric),              2), 0),
    COALESCE(
      ROUND(
        SUM(COALESCE((p->>'entry_kills')::int, 0))::numeric
        / NULLIF(SUM(COALESCE((p->>'rounds_played')::int, 0)), 0),
        4
      ), 0
    ),
    COALESCE(
      ROUND(
        SUM(COALESCE((p->>'clutch_wins')::int, 0))::numeric
        / NULLIF(SUM(COALESCE((p->>'clutch_attempts')::int, 0)), 0),
        4
      ), 0
    )
  INTO v_avg_rating, v_avg_adr, v_entry_rate, v_clutch_rate
  FROM demos d
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(d.parsed_data->'players') = 'array'
      THEN d.parsed_data->'players'
      ELSE '[]'::jsonb
    END
  ) AS p
  WHERE d.team_id   = p_team_id
    AND d.status    = 'completed'
    AND d.demo_type = 'opponent'
    AND d.parsed_data IS NOT NULL
    -- Match only opponent-side players using the same logic as aggregate-players.ts
    AND (
      ( COALESCE(d.parsed_data->>'opponentSide', 'team2') = 'team2'
        AND (p->>'team') = (d.parsed_data->'header'->>'team2') )
      OR
      ( d.parsed_data->>'opponentSide' = 'team1'
        AND (p->>'team') = (d.parsed_data->'header'->>'team1') )
    );

  -- ── Upsert ────────────────────────────────────────────────────────────────
  INSERT INTO team_stats_cache (
    team_id, total_matches, wins, losses, draws, win_rate,
    avg_rating, avg_adr, entry_rate, clutch_rate, maps_played, updated_at
  ) VALUES (
    p_team_id, v_total, v_wins, v_losses, v_draws, v_win_rate,
    v_avg_rating, v_avg_adr, v_entry_rate, v_clutch_rate, v_maps, NOW()
  )
  ON CONFLICT (team_id) DO UPDATE SET
    total_matches = EXCLUDED.total_matches,
    wins          = EXCLUDED.wins,
    losses        = EXCLUDED.losses,
    draws         = EXCLUDED.draws,
    win_rate      = EXCLUDED.win_rate,
    avg_rating    = EXCLUDED.avg_rating,
    avg_adr       = EXCLUDED.avg_adr,
    entry_rate    = EXCLUDED.entry_rate,
    clutch_rate   = EXCLUDED.clutch_rate,
    maps_played   = EXCLUDED.maps_played,
    updated_at    = EXCLUDED.updated_at;
END;
$$;

-- Grant execute to authenticated users (dashboard manual refresh calls this via RPC)
GRANT EXECUTE ON FUNCTION refresh_team_stats(UUID) TO authenticated;
