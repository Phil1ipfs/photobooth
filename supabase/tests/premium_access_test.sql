-- Run after migration 010 in the Supabase SQL Editor.
-- Throwaway accounts and every test write are rolled back at the end.
begin;
create temp table premium_access_results (check_name text, passed boolean, detail text);
create temp table premium_access_users (kind text, id uuid);

do $$
declare
  free_u uuid := gen_random_uuid();
  host_u uuid := gen_random_uuid();
  guest_u uuid := gen_random_uuid();
  admin_u uuid := gen_random_uuid();
  expired_u uuid := gen_random_uuid();
  uid uuid;
  result jsonb;
  free_creation uuid;
  paid_creation uuid;
  room public.ldr_rooms;
  blocked boolean;
begin
  insert into premium_access_users values ('free', free_u), ('premium', host_u), ('guest', guest_u), ('admin', admin_u), ('expired', expired_u);
  foreach uid in array array[free_u, host_u, guest_u, admin_u, expired_u] loop
    insert into auth.users (id, email, aud, role, created_at, updated_at)
      values (uid, uid::text || '@premium-test.invalid', 'authenticated', 'authenticated', now(), now());
  end loop;
  insert into public.admins (user_id) values (admin_u);
  foreach uid in array array[host_u, guest_u, expired_u] loop
    insert into public.subscriptions (user_id, provider, external_id, plan, tier, status, current_period_start, current_period_end, cancel_at_period_end)
      values (uid, 'paymongo', 'qa_' || uid::text, 'premium_monthly', 'premium', 'active', now() - interval '31 days',
        case when uid = expired_u then now() - interval '1 day' else now() + interval '30 days' end, true);
  end loop;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', free_u, 'role', 'authenticated')::text, true);
  insert into premium_access_results values ('Free: no Premium access', not public.has_premium_access(), null);
  result := public.claim_strip_creation('classic', 'strip-1x4');
  free_creation := (result->>'id')::uuid;
  insert into premium_access_results values ('Free: classic photo creation allowed', (result->>'allowed')::boolean, result::text);
  result := public.finalize_strip_creation(free_creation, 'v1:classic-free-photo', 'classic', 'strip-1x4');
  insert into premium_access_results values ('Free: classic download authorized', (result->>'allowed')::boolean, result::text);
  result := public.finalize_strip_creation(free_creation, 'v1:classic-free-photo', 'classic', 'strip-1x4');
  insert into premium_access_results values ('Free: same classic photo can be downloaded again', (result->>'allowed')::boolean, result::text);
  blocked := false;
  begin perform public.claim_strip_creation('love-hearts', 'strip-1x4');
  exception when insufficient_privilege then blocked := sqlerrm = 'premium_required'; end;
  insert into premium_access_results values ('Free: other templates blocked through RPC', blocked, null);
  blocked := false;
  begin perform public.claim_strip_creation('classic', 'grid-2x2');
  exception when insufficient_privilege then blocked := sqlerrm = 'premium_required'; end;
  insert into premium_access_results values ('Free: advanced layouts blocked through RPC', blocked, null);
  blocked := false;
  begin perform public.finalize_strip_creation(free_creation, 'v1:changed-paid-look', 'polaroid', 'strip-1x4');
  exception when insufficient_privilege then blocked := sqlerrm = 'premium_required'; end;
  insert into premium_access_results values ('Free: finalizing a paid template blocked', blocked, null);
  blocked := false;
  begin perform public.create_ldr_room();
  exception when insufficient_privilege then blocked := sqlerrm = 'premium_required'; end;
  insert into premium_access_results values ('Free: cannot create LDR rooms', blocked, null);
  blocked := false;
  begin
    insert into public.strips (user_id, storage_path, template_id, template_name, layout_id, creation_id)
      values (free_u, free_u::text || '/qa.png', 'classic', 'Classic', 'strip-1x4', free_creation);
  exception when insufficient_privilege then blocked := sqlerrm = 'premium_required'; end;
  insert into premium_access_results values ('Free: cloud saving blocked by trigger', blocked, null);

  result := public.claim_strip_creation('classic', 'strip-1x2');
  insert into premium_access_results values ('Free: second classic photo strip allowed', (result->>'allowed')::boolean, result::text);
  result := public.claim_strip_creation('classic', 'strip-1x4');
  insert into premium_access_results values ('Free: two-strip allowance still enforced', not (result->>'allowed')::boolean and result->>'reason' = 'strip_limit_reached', result::text);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', host_u, 'role', 'authenticated')::text, true);
  insert into premium_access_results values ('Premium: active for the full paid month', public.has_premium_access(), null);
  room := public.create_ldr_room();
  insert into premium_access_results values ('Premium: create room and membership allowed', room.id is not null and public.is_ldr_member(room.id::text), null);
  result := public.claim_strip_creation('polaroid', 'grid-2x2');
  paid_creation := (result->>'id')::uuid;
  perform public.finalize_strip_creation(paid_creation, 'v1:premium-grid-photo', 'polaroid', 'grid-2x2');
  insert into public.strips (user_id, storage_path, template_id, template_name, layout_id, creation_id)
    values (host_u, host_u::text || '/qa.png', 'polaroid', 'Polaroid', 'grid-2x2', paid_creation);
  insert into premium_access_results values ('Premium: cloud saving allowed', exists(select 1 from public.strips where creation_id = paid_creation), null);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', free_u, 'role', 'authenticated')::text, true);
  blocked := false;
  begin perform public.join_ldr_room(room.code);
  exception when insufficient_privilege then blocked := sqlerrm = 'premium_required'; end;
  insert into premium_access_results values ('Free: cannot join a paid host via invite code', blocked, null);
  -- A room created before migration 010 must not preserve Free access.
  update public.ldr_rooms set guest_id = free_u where id = room.id;
  insert into premium_access_results values ('Free: old room membership does not grant Realtime/storage access', not public.is_ldr_member(room.id::text), null);
  update public.ldr_rooms set guest_id = null where id = room.id;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', guest_u, 'role', 'authenticated')::text, true);
  perform public.join_ldr_room(room.code);
  insert into premium_access_results values ('Premium partner: can join and access room', public.is_ldr_member(room.id::text), null);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', admin_u, 'role', 'authenticated')::text, true);
  room := public.create_ldr_room();
  insert into premium_access_results values ('Admin: paid features remain available', public.has_premium_access() and room.id is not null, null);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', expired_u, 'role', 'authenticated')::text, true);
  blocked := false;
  begin perform public.create_ldr_room();
  exception when insufficient_privilege then blocked := sqlerrm = 'premium_required'; end;
  insert into premium_access_results values ('Expired Premium: returns to Free access', not public.has_premium_access() and blocked, null);
end;
$$;

-- Exercise storage RLS as an actual authenticated Free caller, rather than owner.
grant select on premium_access_users to authenticated;
grant insert, select on premium_access_results to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', id, 'role', 'authenticated')::text, true)
  from premium_access_users where kind = 'free';
do $$
declare blocked boolean := false;
begin
  begin
    insert into storage.objects (bucket_id, name) values ('strips', auth.uid()::text || '/premium-access-qa.png');
  exception when insufficient_privilege then blocked := true; end;
  insert into premium_access_results values ('Free: direct storage uploads blocked by RLS', blocked, null);
end;
$$;
reset role;
select case when passed then 'PASS' else 'FAIL' end as result, check_name, detail from premium_access_results;
rollback;
