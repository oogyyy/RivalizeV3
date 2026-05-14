-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================================
-- PROFILES
-- ======================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  steam_id TEXT UNIQUE,
  discord_id TEXT UNIQUE,
  faceit_id TEXT,
  favorite_maps TEXT[] DEFAULT '{}',
  preferred_roles TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ======================================
-- USER SETTINGS
-- ======================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT TRUE,
  ai_coach_ready BOOLEAN DEFAULT TRUE,
  public_profile BOOLEAN DEFAULT TRUE,
  demo_sharing BOOLEAN DEFAULT FALSE,
  ai_model_preference TEXT DEFAULT 'gpt-4o',
  ai_response_style TEXT DEFAULT 'detailed',
  theme TEXT DEFAULT 'dark',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- ======================================
-- TEAMS
-- ======================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  logo_url TEXT,
  description TEXT,
  invite_code TEXT UNIQUE DEFAULT upper(substring(md5(random()::text), 1, 6)),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view teams" ON teams
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM team_members WHERE team_id = teams.id
    )
  );

CREATE POLICY "Authenticated users can create teams" ON teams
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Team owners and admins can update teams" ON teams
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM team_members
      WHERE team_id = teams.id AND role IN ('owner', 'admin')
    )
  );

-- ======================================
-- TEAM MEMBERS
-- ======================================
CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view membership" ON team_members
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM team_members tm WHERE tm.team_id = team_members.team_id
    )
  );

CREATE POLICY "Owners and admins can manage members" ON team_members
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM team_members tm
      WHERE tm.team_id = team_members.team_id AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can join teams (insert themselves)" ON team_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ======================================
-- DEMOS
-- ======================================
CREATE TABLE IF NOT EXISTS demos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  opponent_name TEXT NOT NULL,
  opponent_slug TEXT,
  map TEXT NOT NULL,
  match_date TIMESTAMPTZ,
  league TEXT,
  raw_file_path TEXT NOT NULL,
  parsed_data JSONB,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  file_size_bytes BIGINT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS demos_team_id_idx ON demos(team_id);
CREATE INDEX IF NOT EXISTS demos_opponent_slug_idx ON demos(opponent_slug);
CREATE INDEX IF NOT EXISTS demos_status_idx ON demos(status);

ALTER TABLE demos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view demos" ON demos
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM team_members WHERE team_id = demos.team_id
    )
  );

CREATE POLICY "Team members can upload demos" ON demos
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM team_members WHERE team_id = demos.team_id
    )
  );

CREATE POLICY "Team members can update demos" ON demos
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM team_members WHERE team_id = demos.team_id
    )
  );

-- ======================================
-- TEAM FOLDERS
-- ======================================
CREATE TABLE IF NOT EXISTS team_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  opponent_slug TEXT NOT NULL,
  opponent_display_name TEXT NOT NULL,
  aggregated_stats JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_team_id, opponent_slug)
);

ALTER TABLE team_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view folders" ON team_folders
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM team_members WHERE team_id = team_folders.user_team_id
    )
  );

CREATE POLICY "Team members can manage folders" ON team_folders
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM team_members WHERE team_id = team_folders.user_team_id
    )
  );

-- ======================================
-- AI COACH SESSIONS
-- ======================================
CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES team_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New Session',
  messages JSONB DEFAULT '[]',
  focus_area TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own AI sessions" ON ai_sessions
  FOR ALL USING (auth.uid() = user_id);

-- ======================================
-- FUNCTIONS & TRIGGERS
-- ======================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER team_folders_updated_at BEFORE UPDATE ON team_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('demos', 'demos', false, 536870912, ARRAY['application/octet-stream']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('team-logos', 'team-logos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Avatars are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Team logos are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'team-logos');

CREATE POLICY "Team members can upload demos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'demos' AND auth.role() = 'authenticated');

CREATE POLICY "Team members can access demos" ON storage.objects
  FOR SELECT USING (bucket_id = 'demos' AND auth.role() = 'authenticated');
