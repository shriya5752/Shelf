-- Lets people add a title by hand when search can't find it (source = 'custom').
-- Paste into Supabase: SQL Editor -> New query -> Run. Safe to re-run.
alter table public.entries drop constraint if exists entries_source_check;
alter table public.entries add constraint entries_source_check check (source in ('tmdb', 'demo', 'custom'));
