CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL,
  title       text        NOT NULL,
  body        text,
  link        text,
  read        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, created_at DESC)
  WHERE NOT read;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications read"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
