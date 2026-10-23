-- Migration 002: "want to watch" list.
-- Run once in: Supabase dashboard > SQL Editor > New query > paste > Run.
-- Safe to run more than once.

alter table public.entries
  add column if not exists status text not null default 'watched'
  check (status in ('watched', 'want'));

create index if not exists entries_user_status_idx on public.entries (user_id, status);
