-- PhotoBooth — Supabase schema
-- Run once in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run (idempotent).

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user (name + small avatar data URL)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  avatar text,                          -- small JPEG data URL (≈20 KB), or null
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Create the profile automatically when someone signs up (email or OAuth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Saved photo strips (metadata; the PNG lives in the "strips" storage bucket)
-- ---------------------------------------------------------------------------
create table if not exists public.strips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null,           -- "<user_id>/<strip id>.png"
  template_id text not null,
  template_name text not null,
  layout_id text,
  width int,
  height int,
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists strips_user_created_idx on public.strips (user_id, created_at desc);

alter table public.strips enable row level security;

drop policy if exists "strips: read own" on public.strips;
create policy "strips: read own" on public.strips
  for select using (auth.uid() = user_id);

drop policy if exists "strips: insert own" on public.strips;
create policy "strips: insert own" on public.strips
  for insert with check (auth.uid() = user_id);

drop policy if exists "strips: update own" on public.strips;
create policy "strips: update own" on public.strips
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "strips: delete own" on public.strips;
create policy "strips: delete own" on public.strips
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: private bucket, each user may only touch files in their own folder
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('strips', 'strips', false, 10485760, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "strips bucket: read own" on storage.objects;
create policy "strips bucket: read own" on storage.objects
  for select using (bucket_id = 'strips' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "strips bucket: upload own" on storage.objects;
create policy "strips bucket: upload own" on storage.objects
  for insert with check (bucket_id = 'strips' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "strips bucket: delete own" on storage.objects;
create policy "strips bucket: delete own" on storage.objects
  for delete using (bucket_id = 'strips' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Self-service account deletion (the browser can't delete auth users directly).
-- Profiles and strip rows cascade; the app removes the user's files first.
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
