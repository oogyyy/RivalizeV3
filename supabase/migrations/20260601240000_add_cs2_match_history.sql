-- CS2 match history tracking via sharecode chain
-- Stores discovered matches and links to imported demos

-- Auth token + seed code per user
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS steam_auth_token TEXT,
  ADD COLUMN IF NOT EXISTS cs2_last_sharecode TEXT;

-- Discovered CS2 Premier/Competitive matches
CREATE TABLE IF NOT EXISTS cs2_matches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sharecode       TEXT        NOT NULL,
  match_id        TEXT        NOT NULL,
  reservation_id  TEXT        NOT NULL,
  tv_port         INTEGER,
  discovered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  demo_id         UUID        REFERENCES demos(id) ON DELETE SET NULL,
  UNIQUE(user_id, sharecode)
);

CREATE INDEX IF NOT EXISTS cs2_matches_user_idx ON cs2_matches(user_id, discovered_at DESC);

-- RLS
ALTER TABLE cs2_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cs2_matches"
  ON cs2_matches FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
