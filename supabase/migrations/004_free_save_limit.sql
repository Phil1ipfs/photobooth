-- PhotoBooth — free accounts can keep at most 2 saved strips (run AFTER 003). Safe to re-run.
-- Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Keep the limit in sync with FREE_SAVED_STRIP_LIMIT in src/config/catalog.js
-- (a unit test checks it). Premium and admin accounts are unlimited. Deleting a
-- strip frees a slot; strips saved before this limit (or while Premium) are kept.

create or replace function public.enforce_free_save_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  free_limit constant int := 2;
begin
  if public.current_tier(new.user_id) = 'free' then
    -- Serialise saves per user so two parallel inserts can't both slip under the limit.
    perform pg_advisory_xact_lock(hashtext('strip_save:' || new.user_id::text));
    if (select count(*) from public.strips where user_id = new.user_id) >= free_limit then
      raise exception 'strip_limit_reached' using errcode = '42501',
        hint = 'Free accounts can keep 2 saved strips. Upgrade to Premium for unlimited saves.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists strips_enforce_free_limit on public.strips;
create trigger strips_enforce_free_limit
  before insert on public.strips
  for each row execute function public.enforce_free_save_limit();

revoke all on function public.enforce_free_save_limit() from public, anon, authenticated;
