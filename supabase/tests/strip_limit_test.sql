-- Test of the Free photostrip limit against the REAL database functions
-- (run AFTER 005_strip_creation_limit.sql). Paste into the Supabase SQL Editor → Run.
-- Creates 3 throwaway accounts (free / premium / admin), exercises the rules, shows
-- PASS/FAIL per check, then deletes everything it created. Real users are untouched.

create temp table if not exists strip_test_results (n serial, check_name text, pass boolean, detail text);
truncate strip_test_results;

do $$
declare
  free_u  uuid := '0f000000-0000-4000-8000-00000000f001';
  prem_u  uuid := '0f000000-0000-4000-8000-00000000f002';
  admin_u uuid := '0f000000-0000-4000-8000-00000000f003';
  r jsonb; c1 uuid; c2 uuid; i int; ok boolean; msg text;
begin
  -- throwaway accounts
  delete from auth.users where id in (free_u, prem_u, admin_u);
  insert into auth.users (id, email, aud, role, created_at, updated_at)
  values (free_u,  'strip-test-free@example.invalid',  'authenticated', 'authenticated', now(), now()),
         (prem_u,  'strip-test-prem@example.invalid',  'authenticated', 'authenticated', now(), now()),
         (admin_u, 'strip-test-admin@example.invalid', 'authenticated', 'authenticated', now(), now());
  insert into public.subscriptions (user_id, provider, external_id, plan, tier, status, current_period_start, current_period_end, cancel_at_period_end)
  values (prem_u, 'paymongo', 'strip_test_' || prem_u::text, 'premium_monthly', 'premium', 'active', now(), now() + interval '30 days', true);
  insert into public.admins (user_id) values (admin_u);

  -- ---------------- FREE ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', free_u, 'role', 'authenticated')::text, true);

  r := public.claim_strip_creation('classic', 'strip-4'); c1 := (r->>'id')::uuid;
  insert into strip_test_results (check_name, pass, detail) values ('Free: strip #1 allowed', (r->>'allowed')::boolean, r::text);
  r := public.finalize_strip_creation(c1, 'v1:test-strip-1', 'classic', 'strip-4');
  insert into strip_test_results (check_name, pass, detail) values ('Free: strip #1 export allowed', (r->>'allowed')::boolean, r::text);
  r := public.finalize_strip_creation(c1, 'v1:test-strip-1');
  insert into strip_test_results (check_name, pass, detail) values ('Free: re-download same strip #1 allowed', (r->>'allowed')::boolean, r::text);
  r := public.finalize_strip_creation(c1, 'v1:test-strip-1-other-template');
  insert into strip_test_results (check_name, pass, detail) values ('Free: other template on strip #1 needs a new strip', not (r->>'allowed')::boolean, r::text);

  r := public.claim_strip_creation('classic', 'grid-2x2'); c2 := (r->>'id')::uuid;
  insert into strip_test_results (check_name, pass, detail) values ('Free: strip #2 allowed', (r->>'allowed')::boolean, r::text);
  perform public.finalize_strip_creation(c2, 'v1:test-strip-2');

  r := public.claim_strip_creation('retro', 'strip-4');
  insert into strip_test_results (check_name, pass, detail) values ('Free: strip #3 BLOCKED', not (r->>'allowed')::boolean and r->>'reason' = 'strip_limit_reached', r::text);
  for i in 1..10 loop r := public.claim_strip_creation('x', 'y'); end loop;
  insert into strip_test_results (check_name, pass, detail)
  values ('Free: 10 more attempts all blocked, count stays 2', (select count(*) from public.photostrip_creations where user_id = free_u) = 2, r::text);

  -- saving: needs a finalized creation of your own, once
  begin
    insert into public.strips (user_id, storage_path, template_id, template_name, layout_id) values (free_u, free_u || '/x.png', 'classic', 'Classic', 'strip-4');
    ok := false; msg := 'insert without creation succeeded';
  exception when others then ok := sqlerrm = 'creation_required'; msg := sqlerrm; end;
  insert into strip_test_results (check_name, pass, detail) values ('Free: saving a strip without a creation is refused', ok, msg);

  insert into public.strips (user_id, storage_path, template_id, template_name, layout_id, creation_id) values (free_u, free_u || '/1.png', 'classic', 'Classic', 'strip-4', c1);
  begin
    insert into public.strips (user_id, storage_path, template_id, template_name, layout_id, creation_id) values (free_u, free_u || '/1b.png', 'classic', 'Classic', 'strip-4', c1);
    ok := false; msg := 'second save of the same creation succeeded';
  exception when unique_violation then ok := true; msg := sqlerrm; end;
  insert into strip_test_results (check_name, pass, detail) values ('Free: the same strip can''t be saved twice', ok, msg);

  -- deleting does not give the allowance back
  delete from public.strips where user_id = free_u;
  r := public.claim_strip_creation('classic', 'strip-4');
  insert into strip_test_results (check_name, pass, detail) values ('Free: still blocked after deleting saved strips', not (r->>'allowed')::boolean, r::text);
  r := public.get_my_strip_usage();
  insert into strip_test_results (check_name, pass, detail) values ('Free: usage shows 2 / 2', (r->>'used')::int = 2 and (r->>'limit')::int = 2, r::text);

  -- another user's creation can't be used
  perform set_config('request.jwt.claims', json_build_object('sub', prem_u, 'role', 'authenticated')::text, true);
  r := public.finalize_strip_creation(c1, 'v1:stolen');
  insert into strip_test_results (check_name, pass, detail) values ('Another account can''t use Free user''s strip', not (r->>'allowed')::boolean, r::text);

  -- ---------------- PREMIUM ----------------
  ok := true;
  for i in 1..5 loop
    r := public.claim_strip_creation('magazine', 'grid-2x2');
    ok := ok and (r->>'allowed')::boolean;
  end loop;
  insert into strip_test_results (check_name, pass, detail) values ('Premium: 5 strips in a row allowed (unlimited)', ok, r::text);

  -- ---------------- ADMIN / OWNER ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin_u, 'role', 'authenticated')::text, true);
  ok := true;
  for i in 1..5 loop
    r := public.claim_strip_creation('magazine', 'grid-2x2');
    ok := ok and (r->>'allowed')::boolean;
  end loop;
  insert into strip_test_results (check_name, pass, detail) values ('Admin/owner: 5 strips in a row allowed (unlimited)', ok, r::text);

  -- ---------------- permissions ----------------
  insert into strip_test_results (check_name, pass, detail) values (
    'Guests (anon) can''t call the functions; clients can''t touch the ledger',
    not has_function_privilege('anon', 'public.claim_strip_creation(text,text)', 'execute')
      and not has_function_privilege('anon', 'public.finalize_strip_creation(uuid,text,text,text)', 'execute')
      and (select relrowsecurity from pg_class where oid = 'public.photostrip_creations'::regclass)
      and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'photostrip_creations'),
    'RLS on, no policies');

  -- clean up everything this test created
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id in (free_u, prem_u, admin_u);
end $$;

select n as "#", case when pass then '✅ PASS' else '❌ FAIL' end as result, check_name as "check", detail
from strip_test_results order by n;
