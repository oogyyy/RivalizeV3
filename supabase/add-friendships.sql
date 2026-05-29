-- Friendships table for the friends feature
CREATE TABLE IF NOT EXISTS friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_friend CHECK (requester_id <> addressee_id),
  CONSTRAINT unique_pair UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships (requester_id);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships (addressee_id);
CREATE INDEX IF NOT EXISTS friendships_status_idx    ON friendships (status);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Users can see their own friendships (either direction)
CREATE POLICY "users can view own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Only the requester can insert
CREATE POLICY "users can insert own friendships"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Only the addressee can update (accept/reject)
CREATE POLICY "addressee can update friendship"
  ON friendships FOR UPDATE
  USING (auth.uid() = addressee_id);

-- Either party can delete (unfriend / cancel)
CREATE POLICY "either party can delete friendship"
  ON friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
