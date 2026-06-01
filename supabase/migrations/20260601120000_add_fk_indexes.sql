-- Add missing indexes on foreign key columns.
-- Without these, ON DELETE CASCADE scans and FK-side JOIN lookups do full
-- sequential table scans.

-- ── ai_sessions ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ai_sessions_user_id_idx   ON ai_sessions (user_id);
CREATE INDEX IF NOT EXISTS ai_sessions_team_id_idx   ON ai_sessions (team_id);
CREATE INDEX IF NOT EXISTS ai_sessions_folder_id_idx ON ai_sessions (folder_id);

-- ── demos ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS demos_created_by_idx ON demos (created_by);

-- ── lineups ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS lineups_created_by_idx ON lineups (created_by);

-- ── playbooks ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS playbooks_folder_id_idx ON playbooks (folder_id);

-- ── team_invitations ──────────────────────────────────────────────────────
-- (team_id, invitee_id) unique index exists but invitee_id/inviter_id alone
-- still need their own leading-column indexes for the RLS SELECT policy.
CREATE INDEX IF NOT EXISTS team_invitations_invitee_id_idx ON team_invitations (invitee_id);
CREATE INDEX IF NOT EXISTS team_invitations_inviter_id_idx ON team_invitations (inviter_id);

-- ── team_members ──────────────────────────────────────────────────────────
-- PK is (team_id, user_id). Lookups by user_id alone (e.g. "all teams for
-- this user") cannot use the PK efficiently without a separate index.
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON team_members (user_id);

-- ── teams ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS teams_created_by_idx ON teams (created_by);

-- Drop the redundant partial index on demos.share_id.
-- The unique constraint demos_share_id_key (btree on share_id) already covers
-- equality lookups; the partial index adds no benefit.
DROP INDEX IF EXISTS idx_demos_share_id;
