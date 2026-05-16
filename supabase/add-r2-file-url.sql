-- Add file_url column to demos to store the public Cloudflare R2 download URL.
-- raw_file_path continues to hold the R2 object key (e.g. teamId/timestamp-file.dem).
ALTER TABLE demos ADD COLUMN IF NOT EXISTS file_url TEXT;
