-- ============================================================================
-- Add 'queued' status and supporting columns for reliable demo processing queue
--
-- This is PR 1 of the long-term demo processing reliability fix.
-- See design doc: grok-design-doc-9e3725a9.md
-- ============================================================================

-- 1. Add new queue-related columns (idempotent)
ALTER TABLE demos ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ;
ALTER TABLE demos ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

-- 2. Extend the status CHECK constraint to include 'queued'
-- First drop the old constraint (name may vary by environment)
ALTER TABLE demos
  DROP CONSTRAINT IF EXISTS demos_status_check;

-- Re-add with the full set of valid states
ALTER TABLE demos
  ADD CONSTRAINT demos_status_check
  CHECK (status IN ('queued', 'processing', 'completed', 'failed'));

-- 3. Create a clean, targeted partial index for the new worker claim logic
-- This index is the one the v2 worker will primarily use.
CREATE INDEX IF NOT EXISTS demos_queue_claimable_idx
  ON demos (created_at)
  WHERE status = 'queued'
    AND processing_started_at IS NULL;

-- 4. (Optional but recommended) Keep the old worker index for the transition period.
-- It will naturally stop being used once we stop creating 'processing' rows.
-- We do NOT drop it here.

-- 5. Backfill comment / documentation
COMMENT ON COLUMN demos.status IS
  'queued = waiting for worker, processing = currently being parsed, completed/failed = terminal';
COMMENT ON COLUMN demos.queued_at IS
  'When the demo was enqueued for background processing (set by API routes)'; 
COMMENT ON COLUMN demos.last_heartbeat_at IS
  'Last time the worker touched this job (best-effort during long parses)'; 

-- ============================================================================
-- Idempotent rescue of currently stuck demos
-- Run this (or the separate rescue script) after deploying the new worker.
-- ============================================================================

-- Rescue demos that are stuck in 'processing' without a recent claim.
-- These are the ones that were killed by Railway maxDuration or worker crashes.
UPDATE demos
SET
  status = 'queued',
  processing_started_at = NULL,
  queued_at = NOW(),
  error_message = CASE
    WHEN error_message IS NULL OR error_message = '' THEN '[auto-rescued from stuck processing state]'
    ELSE error_message || ' [auto-rescued from stuck processing state]'
  END,
  -- Reset retry_count so they get fresh attempts under the new system (optional but usually desired)
  retry_count = 0
WHERE status = 'processing'
  AND (
    processing_started_at IS NULL
    OR processing_started_at < NOW() - INTERVAL '10 minutes'
  );

-- Note: The 10-minute threshold is conservative. Adjust in production if needed.
-- After running this, the new worker should start picking up these jobs.
