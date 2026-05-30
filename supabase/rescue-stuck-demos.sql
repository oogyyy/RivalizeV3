-- ============================================================================
-- Standalone rescue script for stuck demos
--
-- Use this in the Supabase SQL Editor when you want manual control,
-- or as part of the rollout for PR 1 of the demo processing reliability fix.
--
-- Safe to run multiple times (idempotent).
-- ============================================================================

-- 1. Rescue long-stuck 'processing' demos (killed by Railway timeouts, worker crashes, etc.)
UPDATE demos
SET
  status = 'queued',
  processing_started_at = NULL,
  queued_at = NOW(),
  error_message = CASE
    WHEN error_message IS NULL OR error_message = '' 
    THEN '[manually rescued from stuck processing]'
    ELSE error_message || ' [manually rescued from stuck processing]'
  END,
  retry_count = 0   -- give them fresh attempts under the new queue system
WHERE status = 'processing'
  AND (
        processing_started_at IS NULL
     OR processing_started_at < NOW() - INTERVAL '8 minutes'
  );

-- 2. Also rescue any 'processing' rows that have been claimed for an extremely long time
-- (these are almost certainly dead)
UPDATE demos
SET
  status = 'queued',
  processing_started_at = NULL,
  queued_at = NOW(),
  error_message = COALESCE(error_message, '') || ' [manually rescued from long-claimed processing]',
  retry_count = 0
WHERE status = 'processing'
  AND processing_started_at < NOW() - INTERVAL '45 minutes';

-- 3. Quick visibility query (run this first to see what will be affected)
-- SELECT id, status, processing_started_at, created_at, error_message
-- FROM demos
-- WHERE status = 'processing'
-- ORDER BY created_at DESC;

-- After running this script, deploy (or ensure you have already deployed) the
-- updated worker that understands the 'queued' state. It will start picking these up.
