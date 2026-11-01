-- Run after 011. All test users, payments, emails and queue state are rolled back.
-- No external emails or real payments are made by this script.
begin;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_anon uuid := gen_random_uuid();
  v_payment text := 'pay_email_test_' || gen_random_uuid()::text;
  v_renewal text := 'pay_email_test_' || gen_random_uuid()::text;
  v_first_end text;
  v_job jsonb;
  v_next jsonb;
  v_recovered jsonb;
begin
  if has_table_privilege('authenticated', 'public.admin_email_notifications', 'select')
    or has_table_privilege('anon', 'public.admin_email_notifications', 'insert')
    or has_function_privilege('authenticated', 'public.claim_admin_email_notification()', 'execute') then
    raise exception 'Browser roles must not have access to email jobs';
  end if;
  if not has_function_privilege('service_role', 'public.claim_admin_email_notification()', 'execute') then
    raise exception 'Server role cannot claim jobs';
  end if;

  insert into auth.users (id, email, aud, role, created_at, updated_at, raw_user_meta_data)
    values (v_user, 'notification-test@example.invalid', 'authenticated', 'authenticated', now(), now(), '{"name":"Notification Test"}');
  if (select count(*) from public.admin_email_notifications where user_id = v_user and kind = 'signup') <> 1 then
    raise exception 'Signup must enqueue exactly one email';
  end if;
  update auth.users set email_confirmed_at = now() where id = v_user;
  if (select count(*) from public.admin_email_notifications where user_id = v_user) <> 1 then
    raise exception 'Later account updates must not duplicate signup alerts';
  end if;
  insert into auth.users (id, is_anonymous, aud, role, created_at, updated_at)
    values (v_anon, true, 'authenticated', 'authenticated', now(), now());
  if exists (select 1 from public.admin_email_notifications where user_id = v_anon) then
    raise exception 'Anonymous guest must not create signup alerts';
  end if;

  insert into public.checkout_sessions (user_id, session_id, reference, plan)
    values (v_user, 'cs_email_' || v_user::text, 'PB-email-' || v_user::text, 'premium_monthly');
  if exists (select 1 from public.admin_email_notifications where user_id = v_user and kind <> 'signup') then
    raise exception 'Unpaid checkout must not enqueue a Premium alert';
  end if;

  perform public.grant_premium_pass(v_user, v_payment, 'premium_monthly', 30, 9900, 'PHP', 'cs_email_' || v_user::text);
  -- Run the deferred trigger after the grant has finished, like transaction commit.
  set constraints queue_admin_premium_email immediate;
  set constraints queue_admin_premium_email deferred;
  select current_period_end::text into v_first_end from public.subscriptions where external_id = 'pass_' || v_user::text;
  if (select count(*) from public.admin_email_notifications where user_id = v_user and kind = 'premium_purchased') <> 1 then
    raise exception 'Confirmed first purchase must enqueue one Premium alert';
  end if;
  if not exists (select 1 from public.admin_email_notifications where event_key = 'premium/' || v_payment
    and (payload->>'expiresAt')::timestamptz = v_first_end::timestamptz and (payload->>'amount')::integer = 9900) then
    raise exception 'Purchase alert must snapshot the resulting expiry and amount';
  end if;

  perform public.grant_premium_pass(v_user, v_payment, 'premium_monthly', 30, 9900, 'PHP', null);
  set constraints queue_admin_premium_email immediate;
  set constraints queue_admin_premium_email deferred;
  if (select count(*) from public.admin_email_notifications where user_id = v_user and kind <> 'signup') <> 1 then
    raise exception 'Repeated webhook/confirmation must not duplicate the payment alert';
  end if;

  perform public.grant_premium_pass(v_user, v_renewal, 'premium_monthly', 30, 9900, 'PHP', null);
  set constraints queue_admin_premium_email immediate;
  set constraints queue_admin_premium_email deferred;
  if not exists (select 1 from public.admin_email_notifications where event_key = 'premium/' || v_renewal
    and kind = 'premium_renewed' and (payload->>'expiresAt')::timestamptz = v_first_end::timestamptz + interval '30 days') then
    raise exception 'Renewal must enqueue the extended expiry';
  end if;
  if not exists (select 1 from public.admin_email_notifications where event_key = 'premium/' || v_payment
    and (payload->>'expiresAt')::timestamptz = v_first_end::timestamptz) then
    raise exception 'Later renewals must not alter an earlier payment snapshot';
  end if;

  -- Isolate claims from any pre-existing jobs, inside this rolled-back transaction.
  update public.admin_email_notifications set status = 'sent' where user_id <> v_user;
  v_job := public.claim_admin_email_notification();
  v_next := public.claim_admin_email_notification();
  if v_job is null or v_next is null or v_job->>'id' = v_next->>'id' then
    raise exception 'A leased job must not be claimed twice';
  end if;
  update public.admin_email_notifications set lease_until = now() - interval '1 minute' where id = (v_job->>'id')::uuid;
  v_recovered := public.claim_admin_email_notification();
  if v_recovered->>'id' <> v_job->>'id' or v_recovered->>'lease_token' = v_job->>'lease_token'
    or (v_recovered->>'attempts')::integer <> 2 then
    raise exception 'Expired worker lease must be recoverable with a new token';
  end if;
  raise notice 'PASS: signup, anonymous exclusion, unpaid checkout, first purchase, renewal, deduplication, expiry snapshots, access grants and lease recovery';
end;
$$;

rollback;
