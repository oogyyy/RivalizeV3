-- AI coach: allow the new 'individual' mode (personal performance coaching
-- over the user's My Demos / personal-team demos).
alter table coach_sessions drop constraint if exists coach_sessions_mode_check;
alter table coach_sessions add constraint coach_sessions_mode_check
  check (mode in ('opponent', 'myteam', 'individual'));
