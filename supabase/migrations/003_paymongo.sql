-- PhotoBooth — switch billing to PayMongo (run AFTER 002_freemium.sql). Safe to re-run.
-- Supabase Dashboard → SQL Editor → New query → paste → Run.
--
-- Model: PayMongo Hosted Checkout sells a one-time "Premium pass" (₱99 = 30 days).
-- No auto-renewal: each paid checkout extends the user's Premium end date. The
-- grant happens in grant_premium_pass() — one transaction, idempotent per PayMongo
-- payment id — so the webhook and the success-page confirmation can both call it
-- safely (whichever arrives first wins; the other is a no-op).

-- ---------------------------------------------------------------------------
-- Provider-neutral column names (were Stripe-specific)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'stripe_subscription_id') then
    alter table public.subscriptions rename column stripe_subscription_id to external_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'stripe_customer_id') then
    alter table public.subscriptions rename column stripe_customer_id to customer_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'billing_events' and column_name = 'stripe_event_id') then
    alter table public.billing_events rename column stripe_event_id to event_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'billing_customers' and column_name = 'stripe_customer_id') then
    alter table public.billing_customers rename column stripe_customer_id to customer_id;
  end if;
end $$;

alter table public.subscriptions alter column customer_id drop not null;
alter table public.subscriptions add column if not exists provider text not null default 'paymongo';
alter table public.billing_events add column if not exists provider text not null default 'paymongo';

-- ---------------------------------------------------------------------------
-- Checkout sessions we created (lets the success page confirm a payment even
-- before the webhook arrives, and only for the user who started it)
-- ---------------------------------------------------------------------------
create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'paymongo',
  session_id text not null unique,          -- PayMongo cs_…
  reference text not null unique,           -- our opaque ref, used in success_url
  plan text not null,
  status text not null default 'open',      -- open | paid
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists checkout_sessions_user_idx on public.checkout_sessions (user_id, created_at desc);
alter table public.checkout_sessions enable row level security;
-- (no policies → only the server's service-role key can read/write)

-- ---------------------------------------------------------------------------
-- Grant / extend a Premium pass (server only)
-- ---------------------------------------------------------------------------
create or replace function public.grant_premium_pass(
  p_user uuid,
  p_payment_id text,
  p_plan text,
  p_days integer,
  p_amount integer,
  p_currency text,
  p_session_id text default null
)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_inserted int;
  v_start timestamptz;
  v_end timestamptz;
  v_external text := 'pass_' || p_user::text;
  v_was_active boolean;
begin
  if p_user is null or p_payment_id is null or p_days is null or p_days <= 0 then
    raise exception 'invalid grant';
  end if;

  -- Idempotency: one grant per PayMongo payment, ever.
  insert into public.billing_events (event_id, event_type, provider, user_id, amount, currency, processed_at)
  values (p_payment_id, 'premium_pass.paid', 'paymongo', p_user, p_amount, lower(p_currency), now())
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select current_period_end into v_end from public.subscriptions where external_id = v_external;
    return jsonb_build_object('granted', false, 'currentPeriodEnd', v_end);
  end if;

  -- Serialise concurrent grants for the same user, then extend from the later of
  -- now() and the current end date (time already paid for is never lost).
  perform pg_advisory_xact_lock(hashtext('premium_pass:' || p_user::text));
  select greatest(now(), coalesce(current_period_end, now())) into v_start
  from public.subscriptions where external_id = v_external;
  v_was_active := v_start is not null and v_start > now();
  v_start := coalesce(v_start, now());
  v_end := v_start + make_interval(days => p_days);

  insert into public.subscriptions as s (
    user_id, provider, customer_id, external_id, plan, tier, price_id, status,
    current_period_start, current_period_end, cancel_at_period_end, canceled_at, ended_at, updated_at
  ) values (
    p_user, 'paymongo', null, v_external, p_plan, 'premium', null, 'active',
    now(), v_end, true, null, null, now()
  )
  on conflict (external_id) do update set
    plan = excluded.plan,
    tier = 'premium',
    status = 'active',
    current_period_start = case when s.current_period_end is null or s.current_period_end < now() then now() else s.current_period_start end,
    current_period_end = v_end,
    cancel_at_period_end = true,
    ended_at = null,
    updated_at = now();

  if p_session_id is not null then
    update public.checkout_sessions set status = 'paid', paid_at = now() where session_id = p_session_id;
  end if;

  insert into public.analytics_events (user_id, event_name, metadata, path)
  values (p_user, case when v_was_active then 'subscription_renewed' else 'subscription_started' end, jsonb_build_object('plan', p_plan, 'amount', p_amount, 'currency', lower(p_currency), 'days', p_days), '/api/billing');

  return jsonb_build_object('granted', true, 'currentPeriodEnd', v_end);
end;
$$;

revoke all on function public.grant_premium_pass(uuid, text, text, integer, integer, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Entitlements: expose the provider; a pass is "Premium until <date>"
-- ---------------------------------------------------------------------------
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
    'provider', s.provider,
    'status', case when s.status = 'active' and s.current_period_end is not null and s.current_period_end <= now() then 'expired' else s.status end,
    'currentPeriodEnd', s.current_period_end,
    'cancelAtPeriodEnd', coalesce(s.cancel_at_period_end, false),
    'hasBillingAccount', exists (select 1 from public.billing_customers where user_id = auth.uid())
  );
end;
$$;
grant execute on function public.get_my_entitlements() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin metrics: count PayMongo pass payments as revenue
-- ---------------------------------------------------------------------------
do $$
declare
  src text;
begin
  select pg_get_functiondef('public.admin_metrics(timestamptz)'::regprocedure) into src;
  if position('premium_pass.paid' in src) = 0 then
    src := replace(src, 'event_type = ''invoice.paid''', 'event_type in (''invoice.paid'', ''premium_pass.paid'')');
    execute src;
  end if;
end $$;
