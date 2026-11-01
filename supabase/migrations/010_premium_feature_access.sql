-- PhotoBooth: Free = classic still photos + download; advanced features require Premium.
-- Run AFTER 009. Safe to re-run. Pass duration is controlled by the server plan map.
-- Existing saved photos remain readable/downloadable/deletable after expiry.
-- Both participants need an active Premium pass (or admin access) to use LDR.
begin;

-- Safe for RLS: current_tier itself is intentionally not callable by clients.
create or replace function public.has_premium_access()
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and public.current_tier(auth.uid()) in ('premium', 'admin');
$$;
revoke all on function public.has_premium_access() from public, anon;
grant execute on function public.has_premium_access() to authenticated, service_role;

-- Room creation/join plus membership checks used by private Realtime and Storage.
create or replace function public.is_ldr_member(p_room text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_premium_access() and exists (
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
  if not public.has_premium_access() then raise exception 'premium_required' using errcode = '42501'; end if;
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
  if not public.has_premium_access() then raise exception 'premium_required' using errcode = '42501'; end if;
  select * into v_room from public.ldr_rooms where code = upper(trim(p_code)) for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.expires_at <= now() then raise exception 'room_expired'; end if;
  if v_uid in (v_room.host_id, v_room.guest_id) then return v_room; end if;
  if v_room.guest_id is not null then raise exception 'room_full'; end if;
  update public.ldr_rooms set guest_id = v_uid where id = v_room.id returning * into v_room;
  return v_room;
end;
$$;


-- Keep the existing two-strip allowance; reject Premium looks on direct RPC calls.
create or replace function public.claim_strip_creation(p_template text default null, p_layout text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  free_limit constant int := 2;
  v_tier text;
  v_used int;
  v_id uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('strip_creation:' || uid::text));

  v_tier := public.current_tier(uid);
  if v_tier = 'free' and (coalesce(p_template, 'classic') <> 'classic' or coalesce(p_layout, 'strip-1x4') not in ('strip-1x4', 'strip-1x2')) then
    raise exception 'premium_required' using errcode = '42501';
  end if;
  select count(*) into v_used from public.photostrip_creations where user_id = uid and tier = 'free';

  if v_tier = 'free' and v_used >= free_limit then
    return jsonb_build_object('allowed', false, 'reason', 'strip_limit_reached', 'used', v_used, 'limit', free_limit, 'unlimited', false);
  end if;

  insert into public.photostrip_creations (user_id, tier, template_id, layout_id)
  values (uid, v_tier, left(p_template, 64), left(p_layout, 64))
  returning id into v_id;

  return jsonb_build_object(
    'allowed', true, 'id', v_id,
    'used', v_used + case when v_tier = 'free' then 1 else 0 end,
    'limit', free_limit, 'unlimited', v_tier <> 'free'
  );
end;
$$;

create or replace function public.finalize_strip_creation(p_id uuid, p_signature text, p_template text default null, p_layout text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.photostrip_creations;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_signature is null or length(p_signature) not between 8 and 200 then
    raise exception 'invalid_signature' using errcode = '22023';
  end if;

  select * into c from public.photostrip_creations where id = p_id and user_id = uid for update;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'unknown_creation');
  end if;

  if public.current_tier(uid) = 'free' and (coalesce(p_template, c.template_id, 'classic') <> 'classic' or coalesce(p_layout, c.layout_id, 'strip-1x4') not in ('strip-1x4', 'strip-1x2')) then
    raise exception 'premium_required' using errcode = '42501';
  end if;

  if c.signature is null then
    update public.photostrip_creations
    set signature = p_signature, finalized_at = now(),
        template_id = coalesce(left(p_template, 64), template_id), layout_id = coalesce(left(p_layout, 64), layout_id)
    where id = c.id;
    return jsonb_build_object('allowed', true);
  end if;

  if c.signature = p_signature or public.current_tier(uid) in ('premium', 'admin') then
    return jsonb_build_object('allowed', true);
  end if;
  return jsonb_build_object('allowed', false, 'reason', 'composition_changed');
end;
$$;


revoke all on function public.create_ldr_room() from public, anon;
revoke all on function public.join_ldr_room(text) from public, anon;
revoke all on function public.is_ldr_member(text) from public, anon;
grant execute on function public.create_ldr_room() to authenticated;
grant execute on function public.join_ldr_room(text) to authenticated;
grant execute on function public.is_ldr_member(text) to authenticated;

drop policy if exists "ldr_rooms: members read" on public.ldr_rooms;
create policy "ldr_rooms: members read" on public.ldr_rooms
  for select to authenticated using (public.has_premium_access() and auth.uid() in (host_id, guest_id));

-- Block direct cloud-save calls as well as the UI. Keep read/delete policies.
create or replace function public.enforce_strip_entitlements()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.current_tier(new.user_id) not in ('premium', 'admin') then
    raise exception 'premium_required' using errcode = '42501', hint = 'Free accounts can download classic photos; saving to My Photos requires Premium.';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_strip_entitlements() from public, anon, authenticated;

drop policy if exists "strips: insert own" on public.strips;
create policy "strips: insert own" on public.strips
  for insert to authenticated with check (auth.uid() = user_id and public.has_premium_access());
drop policy if exists "strips: update own" on public.strips;
create policy "strips: update own" on public.strips
  for update to authenticated using (auth.uid() = user_id and public.has_premium_access())
  with check (auth.uid() = user_id and public.has_premium_access());
drop policy if exists "strips bucket: upload own" on storage.objects;
create policy "strips bucket: upload own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'strips' and (storage.foldername(name))[1] = auth.uid()::text and public.has_premium_access()
  );

-- Classic is the only Free template. Latest complete seed mirrors catalog.js.
delete from public.premium_catalog where kind = 'template';
insert into public.premium_catalog (kind, item_id) values
  ('template', 'love-hearts'),
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

commit;
