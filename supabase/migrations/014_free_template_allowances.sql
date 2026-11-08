-- Run after 013. Five free designs, each with 2 photos + 2 Live Strips per account.
-- Lifetime allowances: existing creations are preserved and deletion never resets them.
begin;

alter table public.photostrip_creations add column if not exists media_type text not null default 'photo';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'photostrip_creations_media_type_check' and conrelid = 'public.photostrip_creations'::regclass) then
    alter table public.photostrip_creations add constraint photostrip_creations_media_type_check check (media_type in ('photo', 'live_strip'));
  end if;
end $$;

-- Recover the type of any legacy saved Live Strips without resetting usage.
update public.photostrip_creations c set media_type = 'live_strip'
from public.strips s where s.creation_id = c.id and s.media_type = 'live_strip' and c.media_type <> 'live_strip';
create index if not exists photostrip_creations_allowance_idx
  on public.photostrip_creations (user_id, template_id, media_type) where tier = 'free';

create or replace function public.free_strip_template_ids()
returns text[] language sql immutable set search_path = public as $$
  select array['classic', 'love-hearts', 'polaroid', 'vintage-film', 'pink-pop']::text[];
$$;
create or replace function public.free_strip_mode_limit()
returns int language sql immutable set search_path = public as $$ select 2; $$;
revoke all on function public.free_strip_template_ids() from public, anon, authenticated;
revoke all on function public.free_strip_mode_limit() from public, anon, authenticated;

create or replace function public.strip_usage(uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'used', (select count(*) from public.photostrip_creations where user_id = uid and tier = 'free'),
    'limit', cardinality(public.free_strip_template_ids()) * public.free_strip_mode_limit() * 2,
    'unlimited', public.current_tier(uid) in ('premium', 'admin'),
    'templates', (
      select jsonb_object_agg(template, jsonb_build_object(
        'photo', jsonb_build_object(
          'used', (select count(*) from public.photostrip_creations where user_id = uid and tier = 'free' and template_id = template and media_type = 'photo'),
          'limit', public.free_strip_mode_limit()),
        'live_strip', jsonb_build_object(
          'used', (select count(*) from public.photostrip_creations where user_id = uid and tier = 'free' and template_id = template and media_type = 'live_strip'),
          'limit', public.free_strip_mode_limit())
      )) from unnest(public.free_strip_template_ids()) as t(template)
    )
  );
$$;
revoke all on function public.strip_usage(uuid) from public, anon, authenticated;

create or replace function public.claim_strip_creation_for_mode(
  p_template text default null, p_layout text default null, p_media_type text default 'photo'
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_tier text;
  v_template text := coalesce(p_template, 'classic');
  v_layout text := coalesce(p_layout, 'strip-1x4');
  v_media text := coalesce(p_media_type, 'photo');
  v_used int;
  v_id uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_media not in ('photo', 'live_strip') then raise exception 'invalid_media_type' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('strip_creation:' || uid::text));
  v_tier := public.current_tier(uid);
  if v_tier = 'free' then
    if v_template <> all(public.free_strip_template_ids()) or v_layout not in ('strip-1x4', 'strip-1x2') then
      raise exception 'premium_required' using errcode = '42501';
    end if;
    select count(*) into v_used from public.photostrip_creations
      where user_id = uid and tier = 'free' and template_id = v_template and media_type = v_media;
    if v_used >= public.free_strip_mode_limit() then
      return public.strip_usage(uid) || jsonb_build_object('allowed', false, 'reason', 'strip_limit_reached', 'templateId', v_template, 'mediaType', v_media);
    end if;
  end if;
  insert into public.photostrip_creations (user_id, tier, template_id, layout_id, media_type)
    values (uid, v_tier, left(v_template, 64), left(v_layout, 64), v_media) returning id into v_id;
  return public.strip_usage(uid) || jsonb_build_object('allowed', true, 'id', v_id, 'templateId', v_template, 'mediaType', v_media);
end;
$$;

create or replace function public.finalize_strip_creation_for_mode(
  p_id uuid, p_signature text, p_template text default null, p_layout text default null, p_media_type text default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c public.photostrip_creations;
  v_template text;
  v_layout text;
  v_media text;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_signature is null or length(p_signature) not between 8 and 200 then raise exception 'invalid_signature' using errcode = '22023'; end if;
  select * into c from public.photostrip_creations where id = p_id and user_id = uid for update;
  if not found then return jsonb_build_object('allowed', false, 'reason', 'unknown_creation'); end if;
  v_template := coalesce(p_template, c.template_id, 'classic');
  v_layout := coalesce(p_layout, c.layout_id, 'strip-1x4');
  v_media := coalesce(p_media_type, c.media_type);
  if v_media not in ('photo', 'live_strip') then raise exception 'invalid_media_type' using errcode = '22023'; end if;
  if public.current_tier(uid) = 'free' and
    (v_template <> all(public.free_strip_template_ids()) or v_layout not in ('strip-1x4', 'strip-1x2')) then
    raise exception 'premium_required' using errcode = '42501';
  end if;
  -- A claim pays for exactly one design/type. Neither drafts nor exports can be
  -- moved into another allowance bucket by editing an RPC request.
  if v_template is distinct from coalesce(c.template_id, 'classic') or v_media is distinct from c.media_type then
    return jsonb_build_object('allowed', false, 'reason', 'creation_scope_changed');
  end if;
  if c.signature is null then
    update public.photostrip_creations set signature = p_signature, finalized_at = now(), layout_id = left(v_layout, 64) where id = c.id;
    return jsonb_build_object('allowed', true);
  end if;
  return jsonb_build_object('allowed', c.signature = p_signature or public.current_tier(uid) in ('premium', 'admin'),
    'reason', case when c.signature <> p_signature then 'composition_changed' else null end);
end;
$$;

-- Preserve the old RPC signatures for already-open browser sessions. New code
-- explicitly supplies the media type to the mode-aware functions above.
create or replace function public.claim_strip_creation(p_template text default null, p_layout text default null)
returns jsonb language sql volatile security definer set search_path = public as $$
  select public.claim_strip_creation_for_mode(p_template, p_layout, 'photo');
$$;
create or replace function public.finalize_strip_creation(p_id uuid, p_signature text, p_template text default null, p_layout text default null)
returns jsonb language sql volatile security definer set search_path = public as $$
  select public.finalize_strip_creation_for_mode(p_id, p_signature, p_template, p_layout, null);
$$;
revoke all on function public.claim_strip_creation_for_mode(text, text, text) from public, anon;
revoke all on function public.finalize_strip_creation_for_mode(uuid, text, text, text, text) from public, anon;
grant execute on function public.claim_strip_creation_for_mode(text, text, text) to authenticated;
grant execute on function public.finalize_strip_creation_for_mode(uuid, text, text, text, text) to authenticated;
revoke all on function public.claim_strip_creation(text, text) from public, anon;
revoke all on function public.finalize_strip_creation(uuid, text, text, text) from public, anon;
grant execute on function public.claim_strip_creation(text, text) to authenticated;
grant execute on function public.finalize_strip_creation(uuid, text, text, text) to authenticated;

-- Complete current seed, kept in sync with src/config/catalog.js.
delete from public.premium_catalog where kind = 'template';
insert into public.premium_catalog (kind, item_id) values
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
  ('template', 'ghost-garden'),
  ('template', 'black-cat-club'),
  ('template', 'haunted-arcade'),
  ('template', 'potion-post'),
  ('template', 'candy-coven'),
  ('template', 'midnight-masquerade'),
  ('template', 'ghost-train'),
  ('template', 'stitched-sweethearts'),
  ('template', 'crystal-visions'),
  ('template', 'haunted-seaside'),
  ('template', 'theater-of-us'),
  ('template', 'sealed-with-love'),
  ('template', 'cherry-kisses'),
  ('template', 'swan-serenade'),
  ('template', 'cupid-social-club'),
  ('template', 'moonlit-promise'),
  ('template', 'ribbon-vows'),
  ('template', 'rose-garden-date'),
  ('template', 'mixtape-for-two'),
  ('template', 'love-airmail'),
  ('template', 'miles-apart');

commit;
