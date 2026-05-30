ALTER TABLE profiles ADD COLUMN IF NOT EXISTS faceit_player_id TEXT;

CREATE TABLE IF NOT EXISTS faceit_elo_snapshots (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  elo         INTEGER     NOT NULL,
  level       INTEGER     NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS faceit_elo_snapshots_user_time
  ON faceit_elo_snapshots (user_id, recorded_at DESC);

ALTER TABLE faceit_elo_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "elo_select_own" ON faceit_elo_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "elo_insert_own" ON faceit_elo_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE demos ADD COLUMN IF NOT EXISTS faceit_match_id TEXT;
CREATE INDEX IF NOT EXISTS demos_faceit_match_id ON demos (faceit_match_id) WHERE faceit_match_id IS NOT NULL;
