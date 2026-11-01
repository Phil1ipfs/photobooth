-- Run after 010. New events only: no emails for existing users/payments.
-- Delivery is separate from signup/payment transactions; see docs/admin-email-notifications.md.
begin;

create table if not exists public.admin_email_notifications (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  kind text not null check (kind in ('signup', 'premium_purchased', 'premium_renewed')),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  delivery jsonb, -- Frozen sender/recipient/body: provider retries must be identical.
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'needs_review')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  first_attempt_at timestamptz,
  sent_at timestamptz, -- Resend accepted it; this does not prove Gmail inbox delivery.
  provider_id text,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.admin_email_notifications enable row level security;
revoke all on public.admin_email_notifications from public, anon, authenticated;
grant all on public.admin_email_notifications to service_role;
create index if not exists admin_email_notifications_pending_idx
  on public.admin_email_notifications (available_at, created_at)
  where status in ('pending', 'processing');

create or replace function public.queue_admin_signup_email()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(new.is_anonymous, false) or nullif(new.email, '') is null then return new; end if;
  insert into public.admin_email_notifications (event_key, kind, user_id, payload)
  values ('signup/' || new.id::text, 'signup', new.id, jsonb_build_object(
    'name', left(coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', ''), 256),
    'email', new.email,
    'occurredAt', new.created_at,
    'emailVerified', new.email_confirmed_at is not null,
    'provider', left(coalesce(new.raw_app_meta_data->>'provider', 'email'), 64)
  )) on conflict (event_key) do nothing;
  return new;
end;
$$;
revoke all on function public.queue_admin_signup_email() from public, anon, authenticated;
drop trigger if exists queue_admin_signup_email on auth.users;
create trigger queue_admin_signup_email after insert on auth.users
  for each row execute function public.queue_admin_signup_email();

-- Deferred until commit: grant_premium_pass inserts billing_events BEFORE it
-- extends subscriptions. Capture the resulting expiry, including renewals.
create or replace function public.queue_admin_premium_email()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_user auth.users;
  v_sub public.subscriptions;
  v_renewal boolean;
begin
  if new.event_type <> 'premium_pass.paid' or new.provider <> 'paymongo'
    or new.processed_at is null or new.user_id is null then return new; end if;
  select * into v_user from auth.users where id = new.user_id;
  select * into v_sub from public.subscriptions
    where external_id = 'pass_' || new.user_id::text and user_id = new.user_id
      and tier = 'premium' and status = 'active' and current_period_end is not null;
  if v_user.id is null or v_sub.id is null then return new; end if;
  select exists (select 1 from public.billing_events
    where user_id = new.user_id and event_type = 'premium_pass.paid'
      and processed_at is not null and id <> new.id) into v_renewal;
  insert into public.admin_email_notifications (event_key, kind, user_id, payload)
  values ('premium/' || new.event_id, case when v_renewal then 'premium_renewed' else 'premium_purchased' end,
    new.user_id, jsonb_build_object(
      'name', left(coalesce(v_user.raw_user_meta_data->>'name', v_user.raw_user_meta_data->>'full_name', ''), 256),
      'email', v_user.email,
      'occurredAt', new.processed_at,
      'amount', new.amount,
      'currency', upper(new.currency),
      'plan', v_sub.plan,
      'expiresAt', v_sub.current_period_end,
      'paymentId', new.event_id
    )) on conflict (event_key) do nothing;
  return new;
end;
$$;
revoke all on function public.queue_admin_premium_email() from public, anon, authenticated;
drop trigger if exists queue_admin_premium_email on public.billing_events;
create constraint trigger queue_admin_premium_email after insert on public.billing_events
  deferrable initially deferred for each row execute function public.queue_admin_premium_email();

-- Atomic lease; overlapping cron invocations cannot send the same job at once.
create or replace function public.claim_admin_email_notification()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_job public.admin_email_notifications;
begin
  select * into v_job from public.admin_email_notifications
    where (status = 'pending' and available_at <= now())
       or (status = 'processing' and lease_until < now())
    order by created_at, id for update skip locked limit 1;
  if not found then return null; end if;
  update public.admin_email_notifications set
    status = 'processing', attempts = attempts + 1,
    lease_token = gen_random_uuid(), lease_until = now() + interval '5 minutes',
    first_attempt_at = coalesce(first_attempt_at, now())
    where id = v_job.id returning * into v_job;
  return to_jsonb(v_job);
end;
$$;
revoke all on function public.claim_admin_email_notification() from public, anon, authenticated;
grant execute on function public.claim_admin_email_notification() to service_role;

commit;
