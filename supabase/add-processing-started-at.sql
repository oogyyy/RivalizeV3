-- Track when a worker claimed a demo to prevent double-processing and detect stalls
ALTER TABLE demos ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS demos_worker_queue_idx
  ON demos (created_at)
  WHERE status = 'processing' AND processing_started_at IS NULL;
