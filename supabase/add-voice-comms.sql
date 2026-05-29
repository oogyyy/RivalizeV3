-- Add voice comms columns to demos table
ALTER TABLE demos
  ADD COLUMN IF NOT EXISTS voice_comms_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS voice_comms_offset_seconds FLOAT DEFAULT 0;
