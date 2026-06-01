-- Add columns for the new two-phase parsing architecture:
--   parsed_json_url  — R2 URL for the full parsed JSON (set by Go parser)
--   parsed_at        — timestamp when Go parser finished (set by Go parser)
--
-- The 'parsed' status is the intermediate state between Go parser completing
-- and the worker writing parsed_data + marking 'completed'.

ALTER TABLE demos ADD COLUMN IF NOT EXISTS parsed_json_url TEXT;
ALTER TABLE demos ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMPTZ;

-- Extend the status check to include 'parsed'
ALTER TABLE demos DROP CONSTRAINT IF EXISTS demos_status_check;
ALTER TABLE demos ADD CONSTRAINT demos_status_check
  CHECK (status IN ('queued', 'processing', 'parsed', 'completed', 'failed'));

-- Index for the worker to quickly find 'parsed' demos waiting to be applied
CREATE INDEX IF NOT EXISTS demos_status_parsed_idx
  ON demos (parsed_at ASC)
  WHERE status = 'parsed';
