-- Phase 13: Public Opponent Library & Community Features

-- Make opponent folders optionally public
ALTER TABLE team_folders
  ADD COLUMN IF NOT EXISTS is_public    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Community ratings (thumbs up / thumbs down per authenticated user)
CREATE TABLE opponent_ratings (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES team_folders(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,
  rating    SMALLINT NOT NULL CHECK (rating IN (1, -1)),  -- 1 = up, -1 = down
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (folder_id, user_id)
);

ALTER TABLE opponent_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can read ratings
CREATE POLICY "public_read_ratings"
  ON opponent_ratings FOR SELECT USING (TRUE);

-- Authenticated users can upsert their own rating
CREATE POLICY "auth_upsert_own_rating"
  ON opponent_ratings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow unauthenticated reads of public team_folders
CREATE POLICY "public_read_public_folders"
  ON team_folders FOR SELECT
  USING (is_public = TRUE);

-- Index for efficient public library queries
CREATE INDEX IF NOT EXISTS idx_team_folders_public
  ON team_folders (is_public, published_at DESC)
  WHERE is_public = TRUE;
