-- Let a user link their own team to its FACEIT/ESEA team page (mirrors the
-- faceit_team_id/faceit_team_name columns already on team_folders for opponents).
ALTER TABLE teams ADD COLUMN IF NOT EXISTS faceit_team_id   TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS faceit_team_name TEXT;
