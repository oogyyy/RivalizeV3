-- Drop the legacy worker queue index.
--
-- This index was used by the old synchronous worker model to find demos
-- in 'status = processing' that had not yet been claimed.
--
-- It has been superseded by the modern `demos_queue_claimable_idx`
-- (which targets `status = 'queued'`).
--
-- Safe to drop now that the new queue system is the primary path.

DROP INDEX IF EXISTS public.demos_worker_queue_idx;
