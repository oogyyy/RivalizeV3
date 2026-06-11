-- Auto-sync opt-in: background discovery of a user's CS2 match history.
-- When enabled, the worker periodically runs the same discovery the manual
-- Sync button does, so matches appear without the user clicking anything.

alter table profiles
  add column if not exists cs2_autosync_enabled boolean not null default false,
  add column if not exists cs2_autosync_team_id uuid references teams(id) on delete set null,
  add column if not exists cs2_last_autosync_at timestamptz;

-- Lets the worker efficiently find opted-in users with a linked Steam account.
create index if not exists profiles_cs2_autosync_idx
  on profiles (cs2_last_autosync_at)
  where cs2_autosync_enabled;
