-- Phase 12: Stripe Subscriptions & Billing

CREATE TABLE subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL UNIQUE,
  stripe_customer_id     TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  plan                   TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro', 'team')),
  status                 TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired')),
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Team members can read their own team's subscription
CREATE POLICY "team_members_read_subscription"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = subscriptions.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Monthly demo quota tracking on teams
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS demos_used_this_month INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quota_reset_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month');

-- Function: get effective plan for a team (defaults to 'free' if no row)
CREATE OR REPLACE FUNCTION get_team_plan(p_team_id UUID)
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT plan FROM subscriptions
     WHERE team_id = p_team_id AND status IN ('active','trialing')),
    'free'
  )
$$;

-- Function: reset quota if the period has passed, then increment
CREATE OR REPLACE FUNCTION increment_team_demo_count(p_team_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  -- Reset counter if quota window has expired
  UPDATE teams
  SET demos_used_this_month = 0,
      quota_reset_at = NOW() + INTERVAL '1 month'
  WHERE id = p_team_id AND quota_reset_at <= NOW();

  -- Increment
  UPDATE teams SET demos_used_this_month = demos_used_this_month + 1
  WHERE id = p_team_id;
END;
$$;
