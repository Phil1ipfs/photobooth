-- PhotoBooth — Free accounts can CREATE at most 2 photostrips, lifetime (run AFTER 004).
-- Supabase Dashboard → SQL Editor → New query → paste → Run. Safe to re-run.
--
-- Replaces 004's "2 saved strips" rule. Model:
--   • A photostrip "creation" is a row in public.photostrip_creations. It's claimed
--     (claim_strip_creation) before the first photo of a new strip is taken; the
--     claim is atomic per user, so parallel requests can't exceed the limit.
--   • The first export (download / save / share / print) locks the creation to that
--     composition — photos + template + layout + filter (finalize_strip_creation).
--     Re-exporting the same composition is free; exporting a different one needs a
--     new creation. So switching template/layout can't produce extra strips.
--   • Saving to My Photos requires a valid, finalized creation owned by the user;
--     each creation can be saved once.
--   • Deleting strips never deletes creations → the lifetime count never resets.
--   • Free usage = creations made while on the Free plan. Premium/admin: unlimited.
-- Keep the limit in sync with FREE_STRIP_LIMIT in src/config/catalog.js (unit-tested).

-- ---------------------------------------------------------------------------
-- Remove the old "2 saved strips" rule (004)
-- ---------------------------------------------------------------------------
drop trigger if exists strips_enforce_free_limit on public.strips;
drop function if exists public.enforce_free_save_limit();

-- ---------------------------------------------------------------------------
-- Creations ledger (append-only for clients: no client policies at all)
-- ---------------------------------------------------------------------------
create table if not exists public.photostrip_creations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tier text not null,                       -- plan at creation time: free | premium | admin
  signature text,                           -- composition fingerprint, set on first export
  template_id text,
  layout_id text,
  source text not null default 'booth',     -- booth | backfill
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);
create index if not exists photostrip_creations_user_idx on public.photostrip_creations (user_id, tier);
alter table public.photostrip_creations enable row level security;
-- (no policies → clients can't read or write it directly; only the functions below)

create or replace function public.strip_usage(uid uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'used', (select count(*) from public.photostrip_creations where user_id = uid and tier = 'free'),
    'limit', 2,
    'unlimited', public.current_tier(uid) in ('premium', 'admin')
  )
$$;
revoke all on function public.strip_usage(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Client API (RPC). Every function acts only for auth.uid().
-- ---------------------------------------------------------------------------

/** { used, limit, unlimited } for the signed-in user. */
create or replace function public.get_my_strip_usage()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  return public.strip_usage(auth.uid());
end;
$$;

/**
 * Claim a new photostrip creation. Returns { allowed, id?, used, limit, unlimited }.
 * Atomic: a per-user transaction lock serialises concurrent claims.
 */
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

/**
 * Lock a creation to its composition on first export, or check a re-export.
 * Returns { allowed, reason? }. reason = 'composition_changed' means this is a
 * different strip and needs its own creation (Free accounts only).
 */
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

revoke all on function public.get_my_strip_usage() from public, anon;
revoke all on function public.claim_strip_creation(text, text) from public, anon;
revoke all on function public.finalize_strip_creation(uuid, text, text, text) from public, anon;
grant execute on function public.get_my_strip_usage() to authenticated;
grant execute on function public.claim_strip_creation(text, text) to authenticated;
grant execute on function public.finalize_strip_creation(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Saved strips must come from a finalized creation (one save per creation)
-- ---------------------------------------------------------------------------
alter table public.strips add column if not exists creation_id uuid references public.photostrip_creations (id) on delete set null;
create unique index if not exists strips_creation_unique on public.strips (creation_id) where creation_id is not null;

create or replace function public.enforce_strip_creation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.creation_id is distinct from old.creation_id then
      raise exception 'creation_immutable' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.creation_id is null or not exists (
    select 1 from public.photostrip_creations
    where id = new.creation_id and user_id = new.user_id and signature is not null
  ) then
    raise exception 'creation_required' using errcode = '42501',
      hint = 'Strips can only be saved from a photostrip created in the booth.';
  end if;
  return new;
end;
$$;

drop trigger if exists strips_enforce_creation on public.strips; -- re-created after the backfill

-- ---------------------------------------------------------------------------
-- Backfill existing users (no data is deleted or reset)
--   • every existing saved strip becomes a finalized creation;
--   • logged-in strips created but never saved (analytics 'photostrip_created')
--     are added so the lifetime count reflects real history.
-- Runs once: skipped when backfill rows already exist.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.photostrip_creations where source = 'backfill') then
    insert into public.photostrip_creations (id, user_id, tier, signature, template_id, layout_id, source, created_at, finalized_at)
    select s.id, s.user_id,
           public.current_tier(s.user_id),
           'backfill:' || s.id::text, s.template_id, s.layout_id, 'backfill', s.created_at, s.created_at
    from public.strips s
    where not exists (select 1 from public.photostrip_creations c where c.id = s.id);

    update public.strips s set creation_id = s.id where s.creation_id is null
      and exists (select 1 from public.photostrip_creations c where c.id = s.id);

    insert into public.photostrip_creations (user_id, tier, signature, source, created_at, finalized_at)
    select e.user_id, public.current_tier(e.user_id), 'backfill:analytics:' || gen_random_uuid()::text, 'backfill', now(), now()
    from (
      select a.user_id, count(*) - coalesce((select count(*) from public.strips s where s.user_id = a.user_id), 0) as extra
      from public.analytics_events a
      where a.event_name = 'photostrip_created' and a.user_id is not null
      group by a.user_id
    ) e
    cross join lateral generate_series(1, greatest(e.extra, 0)::int)
    where exists (select 1 from auth.users u where u.id = e.user_id);
  end if;
end $$;

-- Enforce from now on (created after the backfill, which links existing strips).
create trigger strips_enforce_creation
  before insert or update on public.strips
  for each row execute function public.enforce_strip_creation();
revoke all on function public.enforce_strip_creation() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Premium templates: free accounts get 2 (love-hearts, classic); the other 38 are Premium.
-- Mirrors PREMIUM_TEMPLATE_IDS in src/config/catalog.js (unit-tested). Strips
-- already saved with these templates are kept; only new saves are checked.
-- ---------------------------------------------------------------------------
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
  ('template', 'friends-blue');
