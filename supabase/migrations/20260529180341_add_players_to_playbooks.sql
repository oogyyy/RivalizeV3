ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS players text[] DEFAULT '{}';
