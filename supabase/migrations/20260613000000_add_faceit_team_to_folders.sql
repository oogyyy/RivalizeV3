-- Link opponent folders to their FACEIT / ESEA team page.
-- FACEIT team UUIDs come from the team URL, e.g.
--   https://www.faceit.com/en/teams/ab981603-47bd-4ac6-aed2-4d3d5d18934f/leagues
-- The third-party tool esea.team renders ESEA league stats from the same id.

ALTER TABLE team_folders
  ADD COLUMN IF NOT EXISTS faceit_team_id   TEXT,
  ADD COLUMN IF NOT EXISTS faceit_team_name TEXT;
