-- PhotoBooth — record each account's agreement to the Terms of Use & Privacy Policy
-- (Philippine Data Privacy Act: consent must be informed and recorded). Run AFTER 005.
-- Supabase Dashboard → SQL Editor → New query → paste → Run. Safe to re-run.
--
--   • Email sign-up: the checkbox's policy version is sent as sign-up metadata and
--     stored when the account is created (timestamp = server time).
--   • Google sign-in and existing accounts: the app asks once and calls accept_terms().
--   • Clients can't write these columns directly (only through accept_terms()).
-- Keep the version in sync with TERMS_VERSION in src/config/legal.js.

alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

-- New accounts: store the consent captured on the sign-up form.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_terms text := left(nullif(new.raw_user_meta_data ->> 'terms_version', ''), 32);
begin
  perform set_config('pb.terms_write', 'on', true);
  insert into public.profiles (id, name, terms_version, terms_accepted_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    v_terms,
    case when v_terms is not null then now() end
  )
  on conflict (id) do nothing;
  perform set_config('pb.terms_write', 'off', true);
  return new;
end;
$$;

-- Consent columns can only change through the functions in this file.
create or replace function public.protect_terms_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('pb.terms_write', true), 'off') <> 'on' then
    if tg_op = 'INSERT' then
      new.terms_version := null;
      new.terms_accepted_at := null;
    elsif new.terms_version is distinct from old.terms_version or new.terms_accepted_at is distinct from old.terms_accepted_at then
      raise exception 'terms_readonly' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_terms on public.profiles;
create trigger profiles_protect_terms
  before insert or update on public.profiles
  for each row execute function public.protect_terms_columns();

/** The signed-in user agrees to the given policy version. Returns the stored time. */
create or replace function public.accept_terms(p_version text)
returns timestamptz
language plpgsql volatile security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_at timestamptz := now();
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_version is null or length(p_version) not between 1 and 32 then
    raise exception 'invalid_version' using errcode = '22023';
  end if;
  perform set_config('pb.terms_write', 'on', true);
  insert into public.profiles (id, name, terms_version, terms_accepted_at)
  values (uid, '', p_version, v_at)
  on conflict (id) do update set terms_version = excluded.terms_version, terms_accepted_at = excluded.terms_accepted_at;
  perform set_config('pb.terms_write', 'off', true);
  return v_at;
end;
$$;

revoke all on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;
revoke all on function public.protect_terms_columns() from public, anon, authenticated;
