-- Structured per-player strats on playbooks: array of plays, each with a
-- name, side, and five player→instruction assignments.
alter table playbooks add column if not exists strats jsonb not null default '[]';
