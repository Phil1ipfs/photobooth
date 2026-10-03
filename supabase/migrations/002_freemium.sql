-- PhotoBooth — Freemium, billing & analytics (run AFTER supabase/schema.sql)
-- Supabase Dashboard → SQL Editor → New query → paste → Run. Safe to re-run.
--
-- Security model
--   • Browsers use the publishable key + the user's session (RLS applies).
--   • Only server code with the service-role key (Vercel functions in /api) can
--     write subscriptions / billing data — there are NO client write policies.
--   • Premium status is computed here (current_tier) from Stripe-synced rows.

-- ---------------------------------------------------------------------------
-- Admins (managed manually in SQL; invisible to clients)
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = uid) $$;

-- ---------------------------------------------------------------------------
-- Billing (written only by the Stripe webhook / server functions)
-- ---------------------------------------------------------------------------
create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.billing_customers enable row level security;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  plan text not null,                       -- e.g. premium_monthly (see api/_lib/plans.js)
  tier text not null default 'premium',     -- entitlement level granted while active
  price_id text,
  status text not null,                     -- Stripe status: active, trialing, past_due, canceled, unpaid, incomplete…
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id, current_period_end desc);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions: read own" on public.subscriptions;
create policy "subscriptions: read own" on public.subscriptions
  for select using (auth.uid() = user_id);
-- (no insert/update/delete policies → users can never change their own plan)

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,     -- idempotency key
  event_type text not null,
  user_id uuid references auth.users (id) on delete set null,
  amount integer,                           -- minor units (centavos) for invoice.paid
  currency text,
  processed_at timestamptz,                 -- null until handled successfully
  created_at timestamptz not null default now()
);
create index if not exists billing_events_type_created_idx on public.billing_events (event_type, created_at);
alter table public.billing_events enable row level security;

-- ---------------------------------------------------------------------------
-- Entitlements (source of truth)
-- ---------------------------------------------------------------------------
create or replace function public.current_tier(uid uuid)
returns text
language plpgsql stable security definer set search_path = public
as $$
begin
  if uid is null then return 'free'; end if;
  if public.is_admin(uid) then return 'admin'; end if;
  if exists (
    select 1 from public.subscriptions
    where user_id = uid
      and tier = 'premium'
      and status in ('active', 'trialing', 'past_due')
      and (current_period_end is null or current_period_end > now())
  ) then
    return 'premium';
  end if;
  return 'free';
end;
$$;

create or replace function public.get_my_entitlements()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  s public.subscriptions;
begin
  if auth.uid() is null then
    return jsonb_build_object('plan', 'free');
  end if;
  select * into s from public.subscriptions
  where user_id = auth.uid()
  order by (status in ('active', 'trialing', 'past_due')) desc, current_period_end desc nulls last
  limit 1;
  return jsonb_build_object(
    'plan', public.current_tier(auth.uid()),
    'billingPlan', s.plan,
    'status', s.status,
    'currentPeriodEnd', s.current_period_end,
    'cancelAtPeriodEnd', coalesce(s.cancel_at_period_end, false),
    'hasBillingAccount', exists (select 1 from public.billing_customers where user_id = auth.uid())
  );
end;
$$;

revoke all on function public.current_tier(uuid) from public, anon, authenticated;
revoke all on function public.is_admin(uuid) from public, anon, authenticated;
grant execute on function public.get_my_entitlements() to authenticated;

-- ---------------------------------------------------------------------------
-- Premium catalogue (mirrors src/config/catalog.js — a unit test keeps them in sync)
-- ---------------------------------------------------------------------------
create table if not exists public.premium_catalog (
  kind text not null check (kind in ('template', 'layout')),
  item_id text not null,
  primary key (kind, item_id)
);
alter table public.premium_catalog enable row level security;
drop policy if exists "premium_catalog: public read" on public.premium_catalog;
create policy "premium_catalog: public read" on public.premium_catalog for select using (true);

delete from public.premium_catalog;
insert into public.premium_catalog (kind, item_id) values
  -- templates
  ('template', 'magazine'),
  ('template', 'y2k-chrome'),
  ('template', 'dreamy-lavender'),
  ('template', 'black-red'),
  ('template', 'arcade'),
  ('template', 'newspaper'),
  ('template', 'valentines'),
  ('template', 'summer-vibes'),
  ('template', 'aesthetic-collage'),
  ('template', 'neon-y2k'),
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
  -- layouts
  ('layout', 'grid-2x2'),
  ('layout', 'grid-2x3'),
  ('layout', 'grid-3x2'),
  ('layout', 'feature-4'),
  ('layout', 'panels-4');

-- Server-side enforcement: free accounts can't save Premium templates/layouts.
create or replace function public.enforce_strip_entitlements()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.current_tier(new.user_id) = 'free' and (
    exists (select 1 from public.premium_catalog where kind = 'template' and item_id = new.template_id)
    or exists (select 1 from public.premium_catalog where kind = 'layout' and item_id = new.layout_id)
  ) then
    raise exception 'premium_required' using errcode = '42501', hint = 'This template or layout requires PhotoBooth Premium.';
  end if;
  return new;
end;
$$;

drop trigger if exists strips_enforce_entitlements on public.strips;
create trigger strips_enforce_entitlements
  before insert or update of template_id, layout_id on public.strips
  for each row execute function public.enforce_strip_entitlements();

revoke all on function public.enforce_strip_entitlements() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Analytics (insert-only for browsers; no personal data, no photo contents)
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  anonymous_id uuid,                        -- random per-browser id (no PII)
  session_id uuid,                          -- random per-visit id (30 min idle)
  event_name text not null check (event_name in (
    'page_view', 'signup', 'login', 'logout',
    'photobooth_opened', 'photo_captured', 'photostrip_created', 'photostrip_downloaded', 'photostrip_saved',
    'template_selected', 'template_used', 'template_favorited',
    'premium_gate_shown', 'upgrade_clicked',
    'checkout_started', 'checkout_completed',
    'subscription_started', 'subscription_renewed', 'subscription_cancelled', 'subscription_cancel_scheduled',
    'subscription_payment_failed', 'subscription_expired'
  )),
  path text check (path is null or char_length(path) <= 200),
  metadata jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 2048),
  created_at timestamptz not null default now()
);
create index if not exists analytics_created_idx on public.analytics_events (created_at);
create index if not exists analytics_name_created_idx on public.analytics_events (event_name, created_at);
create index if not exists analytics_anon_idx on public.analytics_events (anonymous_id, created_at);
create index if not exists analytics_user_idx on public.analytics_events (user_id, created_at);
alter table public.analytics_events enable row level security;

-- Browsers may only add events for themselves (or anonymously), and may not
-- forge billing events — those are recorded by the webhook with the service key.
drop policy if exists "analytics: insert own" on public.analytics_events;
create policy "analytics: insert own" on public.analytics_events
  for insert to anon, authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and event_name <> all (array[
      'checkout_started', 'checkout_completed', 'subscription_started', 'subscription_renewed',
      'subscription_cancelled', 'subscription_cancel_scheduled', 'subscription_payment_failed', 'subscription_expired'
    ])
  );
-- (no select policy → only admins via admin_metrics())

create or replace function public.analytics_stamp()
returns trigger language plpgsql as $$
begin
  new.created_at := now();   -- clients can't back-date events
  return new;
end;
$$;
drop trigger if exists analytics_stamp on public.analytics_events;
create trigger analytics_stamp before insert on public.analytics_events
  for each row execute function public.analytics_stamp();

-- ---------------------------------------------------------------------------
-- Admin dashboard metrics (admins only; emails masked)
-- ---------------------------------------------------------------------------
create or replace function public.admin_metrics(p_from timestamptz default null)
returns jsonb
language plpgsql stable security definer set search_path = public, auth
as $$
declare
  v_from timestamptz;
  v_bucket text;
  result jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_from := coalesce(
    p_from,
    least(
      (select min(created_at) from auth.users),
      (select min(created_at) from public.analytics_events),
      now()
    )
  );
  v_bucket := case when now() - v_from > interval '120 days' then 'week' else 'day' end;

  with
  ev as (select * from public.analytics_events where created_at >= v_from),
  active_subs as (
    select distinct s.user_id from public.subscriptions s
    where s.tier = 'premium'
      and s.status in ('active', 'trialing', 'past_due')
      and (s.current_period_end is null or s.current_period_end > now())
      and not public.is_admin(s.user_id)
  ),
  visitors as (select distinct anonymous_id from ev where anonymous_id is not null),
  returning_v as (
    select v.anonymous_id from visitors v
    where exists (select 1 from public.analytics_events e where e.anonymous_id = v.anonymous_id and e.created_at < v_from)
       or (select count(distinct session_id) from ev e2 where e2.anonymous_id = v.anonymous_id) > 1
  ),
  buckets as (
    select generate_series(date_trunc(v_bucket, v_from), date_trunc(v_bucket, now()), ('1 ' || v_bucket)::interval) as b
  )
  select jsonb_build_object(
    'from', v_from,
    'bucket', v_bucket,
    'kpis', jsonb_build_object(
      'totalUsers', (select count(*) from auth.users),
      'newUsers', (select count(*) from auth.users where created_at >= v_from),
      'activeUsers', (select count(distinct user_id) from ev where user_id is not null),
      'visitors', (select count(*) from visitors),
      'returningVisitors', (select count(*) from returning_v),
      'pageViews', (select count(*) from ev where event_name = 'page_view'),
      'sessions', (select count(distinct session_id) from ev where session_id is not null),
      'signups', (select count(*) from auth.users where created_at >= v_from),
      'logins', (select count(*) from ev where event_name = 'login'),
      'photoboothOpened', (select count(*) from ev where event_name = 'photobooth_opened'),
      'photosCaptured', (select count(*) from ev where event_name = 'photo_captured'),
      'stripsCreated', (select count(*) from ev where event_name = 'photostrip_created'),
      'downloads', (select count(*) from ev where event_name = 'photostrip_downloaded'),
      'stripsSaved', (select count(*) from public.strips where created_at >= v_from),
      'checkoutsStarted', (select count(*) from ev where event_name = 'checkout_started'),
      'premiumSubscribers', (select count(*) from active_subs),
      'freeUsers', (select count(*) from auth.users u where not exists (select 1 from active_subs a where a.user_id = u.id)),
      'conversionRate', (
        select case when count(*) = 0 then 0 else round((select count(*) from active_subs)::numeric * 100 / count(*), 1) end
        from auth.users
      ),
      'newSubscriptions', (select count(*) from public.subscriptions where created_at >= v_from),
      'cancellations', (select count(*) from ev where event_name = 'subscription_cancelled'),
      'paymentFailures', (select count(*) from ev where event_name = 'subscription_payment_failed'),
      'revenue', (select coalesce(sum(amount), 0) from public.billing_events where event_type = 'invoice.paid' and created_at >= v_from),
      'revenueAllTime', (select coalesce(sum(amount), 0) from public.billing_events where event_type = 'invoice.paid'),
      'currency', (select upper(currency) from public.billing_events where currency is not null order by created_at desc limit 1)
    ),
    'subscriptionStatus', coalesce((
      select jsonb_object_agg(status, n) from (select status, count(*) n from public.subscriptions group by status) t
    ), '{}'::jsonb),
    'topTemplates', coalesce((
      select jsonb_agg(jsonb_build_object('template', t, 'count', n) order by n desc) from (
        select metadata->>'template' t, count(*) n from ev
        where event_name = 'template_used' and metadata ? 'template'
        group by 1 order by 2 desc limit 8
      ) x
    ), '[]'::jsonb),
    'series', (
      select jsonb_agg(jsonb_build_object(
        'date', b.b,
        'visitors', (select count(distinct anonymous_id) from ev where date_trunc(v_bucket, created_at) = b.b),
        'signups', (select count(*) from auth.users where date_trunc(v_bucket, created_at) = b.b),
        'strips', (select count(*) from ev where event_name = 'photostrip_created' and date_trunc(v_bucket, created_at) = b.b),
        'downloads', (select count(*) from ev where event_name = 'photostrip_downloaded' and date_trunc(v_bucket, created_at) = b.b),
        'subscriptions', (select count(*) from public.subscriptions where date_trunc(v_bucket, created_at) = b.b)
      ) order by b.b)
      from buckets b
    ),
    'recentSignups', coalesce((
      select jsonb_agg(r order by r->>'createdAt' desc) from (
        select jsonb_build_object(
          'name', coalesce(p.name, 'Member'),
          'email', left(split_part(u.email, '@', 1), 1) || '•••@' || split_part(u.email, '@', 2),
          'createdAt', u.created_at,
          'plan', public.current_tier(u.id),
          'provider', coalesce(u.raw_app_meta_data->>'provider', 'email')
        ) r
        from auth.users u left join public.profiles p on p.id = u.id
        order by u.created_at desc limit 10
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_metrics(timestamptz) from public, anon;
grant execute on function public.admin_metrics(timestamptz) to authenticated;
