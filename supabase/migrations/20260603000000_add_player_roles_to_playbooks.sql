-- Add player_roles column to store role assignments per player (name → role)
ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS player_roles jsonb NOT NULL DEFAULT '{}';
