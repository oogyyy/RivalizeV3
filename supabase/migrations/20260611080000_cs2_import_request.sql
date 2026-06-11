-- Lets a user request import of a single discovered match's demo. The worker
-- picks these up and does the heavy download/decompress/parse off the request
-- path. Cleared (demo_id set) once imported.
alter table cs2_matches
  add column if not exists import_requested_at timestamptz;

-- Worker lookup: matches awaiting import (requested, with a demo url, not yet linked).
create index if not exists cs2_matches_import_pending_idx
  on cs2_matches (import_requested_at)
  where import_requested_at is not null and demo_id is null;
