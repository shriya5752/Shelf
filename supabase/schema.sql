-- Shelf: database schema for Supabase.
-- Run this once in: Supabase dashboard > SQL Editor > New query > paste > Run.

-- ---------- tables ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text,
  is_public    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  source      text not null default 'tmdb' check (source in ('tmdb', 'demo')),
  external_id bigint not null,
  media_type  text not null check (media_type in ('movie', 'tv')),
  title       text not null check (char_length(title) between 1 and 300),
  year        int,
  creator     text check (char_length(creator) <= 300),
  genres      text[] not null default '{}',
  poster_url  text check (char_length(poster_url) <= 600),
  color       text not null default '#6b6f5c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  ink         text not null default '#f7efe3' check (ink ~ '^#[0-9a-fA-F]{6}$'),
  seasons     int,
  status      text not null default 'watched' check (status in ('watched', 'want')),
  rating      int not null default 0 check (rating between 0 and 5),
  watched_on  text check (watched_on ~ '^\d{4}-\d{2}(-\d{2})?$'),
  liked       text check (char_length(liked) <= 2000),
  learned     text check (char_length(learned) <= 2000),
  created_at  timestamptz not null default now(),
  unique (user_id, source, media_type, external_id)
);

create index if not exists entries_user_idx on public.entries (user_id);

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.entries  enable row level security;

-- profiles: anyone can read public profiles; owners can read/update their own
create policy "profiles readable if public or own" on public.profiles
  for select using (is_public or auth.uid() = id);
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- entries: readable if the owner's profile is public (or it's yours); only owners write
create policy "entries readable if public or own" on public.entries
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = entries.user_id and p.is_public)
  );
create policy "entries insert own" on public.entries
  for insert with check (auth.uid() = user_id);
create policy "entries update own" on public.entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "entries delete own" on public.entries
  for delete using (auth.uid() = user_id);

-- ---------- create a profile automatically at sign-up ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  final  text;
begin
  if wanted !~ '^[a-z0-9_]{3,20}$' then
    wanted := 'user' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  final := wanted;
  -- if the name is taken, add a short suffix instead of failing the sign-up
  if exists (select 1 from public.profiles where username = final) then
    final := substr(wanted, 1, 14) || '_' || substr(replace(new.id::text, '-', ''), 1, 5);
  end if;
  insert into public.profiles (id, username) values (new.id, final);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
