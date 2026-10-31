-- PhotoBooth — LDR (long-distance) photobooth rooms. Run AFTER 008. Safe to re-run.
-- Supabase Dashboard → SQL Editor → New query → paste → Run.
--
-- Two signed-in people share one private room:
--   ldr_rooms          — who is in the room (host + one guest) and when it expires
--   realtime.messages  — Realtime Broadcast/Presence on topic 'ldr:<room id>' is
--                        allowed only for the room's two members (private channels)
--   storage bucket ldr — each member uploads their own shots to <room>/<user>/…;
--                        only the room's members can read them
-- Saving the finished strip still goes through the normal strips flow, so the Free
-- plan's photostrip limit and Premium template rules apply to each person.

create table if not exists public.ldr_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  guest_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 hours'
);
create index if not exists ldr_rooms_host_idx on public.ldr_rooms (host_id);

alter table public.ldr_rooms enable row level security;
drop policy if exists "ldr_rooms: members read" on public.ldr_rooms;
create policy "ldr_rooms: members read" on public.ldr_rooms
  for select to authenticated using (auth.uid() in (host_id, guest_id));
-- No insert/update/delete policies: rooms change only through the functions below.

/** True when the caller is a member of the (unexpired) room. Takes text so a malformed topic/path never errors. */
create or replace function public.is_ldr_member(p_room text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.ldr_rooms
    where id::text = p_room and auth.uid() in (host_id, guest_id) and expires_at > now()
  );
$$;

create or replace function public.create_ldr_room()
returns public.ldr_rooms
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.ldr_rooms;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  delete from public.ldr_rooms where host_id = v_uid and expires_at <= now();
  if (select count(*) from public.ldr_rooms where host_id = v_uid) >= 5 then
    raise exception 'too_many_rooms';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    begin
      insert into public.ldr_rooms (code, host_id) values (v_code, v_uid) returning * into v_room;
      return v_room;
    exception when unique_violation then
      -- code taken: try another
    end;
  end loop;
end;
$$;

create or replace function public.join_ldr_room(p_code text)
returns public.ldr_rooms
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.ldr_rooms;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_room from public.ldr_rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.expires_at <= now() then raise exception 'room_expired'; end if;
  if v_uid in (v_room.host_id, v_room.guest_id) then return v_room; end if;
  if v_room.guest_id is not null then raise exception 'room_full'; end if;
  update public.ldr_rooms set guest_id = v_uid where id = v_room.id returning * into v_room;
  return v_room;
end;
$$;

revoke all on function public.create_ldr_room() from public, anon;
revoke all on function public.join_ldr_room(text) from public, anon;
grant execute on function public.create_ldr_room() to authenticated;
grant execute on function public.join_ldr_room(text) to authenticated;
grant execute on function public.is_ldr_member(text) to authenticated;

-- Realtime: private channel 'ldr:<room id>' (Broadcast + Presence) for members only.
drop policy if exists "ldr: members receive" on realtime.messages;
create policy "ldr: members receive" on realtime.messages
  for select to authenticated
  using (realtime.topic() like 'ldr:%' and public.is_ldr_member(substr(realtime.topic(), 5)));
drop policy if exists "ldr: members send" on realtime.messages;
create policy "ldr: members send" on realtime.messages
  for insert to authenticated
  with check (realtime.topic() like 'ldr:%' and public.is_ldr_member(substr(realtime.topic(), 5)));

-- Storage: private bucket, JPEG shots only (5 MB each).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ldr', 'ldr', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];

drop policy if exists "ldr: members read shots" on storage.objects;
create policy "ldr: members read shots" on storage.objects
  for select to authenticated
  using (bucket_id = 'ldr' and public.is_ldr_member((storage.foldername(name))[1]));
drop policy if exists "ldr: upload own shots" on storage.objects;
create policy "ldr: upload own shots" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ldr'
    and public.is_ldr_member((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = auth.uid()::text
  );
drop policy if exists "ldr: replace own shots" on storage.objects;
create policy "ldr: replace own shots" on storage.objects
  for update to authenticated
  using (bucket_id = 'ldr' and (storage.foldername(name))[2] = auth.uid()::text)
  with check (bucket_id = 'ldr' and public.is_ldr_member((storage.foldername(name))[1]) and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists "ldr: delete own shots" on storage.objects;
create policy "ldr: delete own shots" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ldr' and (storage.foldername(name))[2] = auth.uid()::text);

-- Premium catalogue: adds the "Miles Apart" romantic scrapbook template.
-- Mirrors PREMIUM_TEMPLATE_IDS in src/config/catalog.js (unit-tested).
delete from public.premium_catalog where kind = 'template';
insert into public.premium_catalog (kind, item_id) values
  ('template', 'polaroid'),
  ('template', 'vintage-film'),
  ('template', 'pink-pop'),
  ('template', 'magazine'),
  ('template', 'cat'),
  ('template', 'y2k-chrome'),
  ('template', 'dreamy-lavender'),
  ('template', 'retro-70s'),
  ('template', 'scrapbook'),
  ('template', 'black-red'),
  ('template', 'arcade'),
  ('template', 'mono'),
  ('template', 'cute-pastel'),
  ('template', 'korean'),
  ('template', 'newspaper'),
  ('template', 'valentines'),
  ('template', 'birthday'),
  ('template', 'friends'),
  ('template', 'modern-minimal'),
  ('template', 'film-frame'),
  ('template', 'summer-vibes'),
  ('template', 'aesthetic-collage'),
  ('template', 'neon-y2k'),
  ('template', 'cherry-pop'),
  ('template', 'galaxy-dreams'),
  ('template', 'vintage-postcard'),
  ('template', 'bw-doodle'),
  ('template', 'space-adventure'),
  ('template', 'retro-90s'),
  ('template', 'floral-elegance'),
  ('template', 'comic-pop'),
  ('template', 'butterfly'),
  ('template', 'music-player'),
  ('template', 'kawaii-animals'),
  ('template', 'newspaper-style'),
  ('template', 'valentine-red'),
  ('template', 'birthday-pastel'),
  ('template', 'friends-blue'),
  ('template', 'happy-halloween'),
  ('template', 'spooky-love'),
  ('template', 'boo-together'),
  ('template', 'pumpkin-night'),
  ('template', 'vampire-date'),
  ('template', 'haunted-mansion'),
  ('template', 'trick-or-treat'),
  ('template', 'witching-hour'),
  ('template', 'skeleton-couple'),
  ('template', 'blood-moon'),
  ('template', 'miles-apart');
