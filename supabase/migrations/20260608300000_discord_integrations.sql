-- Discord integration: one webhook/channel per team
CREATE TABLE discord_integrations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL UNIQUE,
  guild_id    TEXT NOT NULL UNIQUE,
  guild_name  TEXT,
  channel_id  TEXT,
  webhook_url TEXT NOT NULL,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE discord_integrations ENABLE ROW LEVEL SECURITY;

-- Team members can read their own team's integration
CREATE POLICY "team_members_select_discord"
  ON discord_integrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = discord_integrations.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Only owner/admin can manage the integration
CREATE POLICY "team_admin_manage_discord"
  ON discord_integrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = discord_integrations.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    )
  );

-- Short, memorable link code for /rivalize link slash command
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS discord_link_code TEXT UNIQUE
  DEFAULT upper(substring(md5(random()::text), 1, 8));

-- Populate for any existing teams that don't have a code yet
UPDATE teams SET discord_link_code = upper(substring(md5(random()::text), 1, 8))
WHERE discord_link_code IS NULL;
