ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS demo_type TEXT NOT NULL DEFAULT 'opponent'
    CHECK (demo_type IN ('opponent', 'self'));

CREATE INDEX IF NOT EXISTS demos_demo_type_idx ON demos(demo_type);
