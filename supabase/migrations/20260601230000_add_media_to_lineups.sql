ALTER TABLE lineups
  ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('draw', 'youtube', 'video', 'images')),
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS media_urls text[];
