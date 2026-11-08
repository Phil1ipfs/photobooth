-- Run after migration 014. Creates temporary test accounts; ROLLBACK removes them.
begin;
do $$
declare
  free_u uuid := gen_random_uuid();
  other_u uuid := gen_random_uuid();
  premium_u uuid := gen_random_uuid();
  legacy_u uuid := gen_random_uuid();
  uid uuid;
  design text;
  kind text;
  r jsonb;
  first_id uuid;
  first_signature text;
  blocked boolean;
begin
  foreach uid in array array[free_u, other_u, premium_u, legacy_u] loop
    insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
      values (uid, 'authenticated', 'authenticated', 'qa-allowance-' || uid::text || '@example.test', '', now(), now(), now());
  end loop;
  insert into public.subscriptions (user_id, provider, external_id, plan, tier, status, current_period_start, current_period_end, cancel_at_period_end)
    values (premium_u, 'paymongo', 'qa_' || premium_u::text, 'premium_monthly', 'premium', 'active', now(), now() + interval '30 days', true);

  perform set_config('request.jwt.claims', jsonb_build_object('sub', free_u, 'role', 'authenticated')::text, true);
  foreach design in array public.free_strip_template_ids() loop
    foreach kind in array array['photo', 'live_strip'] loop
      for n in 1..2 loop
        r := public.claim_strip_creation_for_mode(design, 'strip-1x4', kind);
        if not (r->>'allowed')::boolean then raise exception 'Expected allowance for % / % / %: %', design, kind, n, r; end if;
        if first_id is null then first_id := (r->>'id')::uuid; first_signature := 'v1:' || first_id::text; end if;
        r := public.finalize_strip_creation_for_mode((r->>'id')::uuid, 'v1:' || (r->>'id'), design, 'strip-1x4', kind);
        if not (r->>'allowed')::boolean then raise exception 'Expected finalization for % / %: %', design, kind, r; end if;
      end loop;
      r := public.claim_strip_creation_for_mode(design, 'strip-1x4', kind);
      if (r->>'allowed')::boolean or r->>'reason' <> 'strip_limit_reached' then raise exception 'Third capture was not blocked: % / %: %', design, kind, r; end if;
    end loop;
  end loop;
  r := public.get_my_strip_usage();
  if (r->>'used')::int <> 20 or (r->>'limit')::int <> 20 then raise exception 'Wrong total usage: %', r; end if;
  if (r #>> '{templates,classic,photo,used}')::int <> 2 or (r #>> '{templates,classic,live_strip,used}')::int <> 2 then raise exception 'Wrong per-mode counters: %', r; end if;

  r := public.finalize_strip_creation_for_mode(first_id, first_signature, 'classic', 'strip-1x4', 'photo');
  if not (r->>'allowed')::boolean then raise exception 'Re-download at limit must remain allowed'; end if;
  r := public.finalize_strip_creation_for_mode(first_id, first_signature, 'classic', 'strip-1x4', 'live_strip');
  if (r->>'allowed')::boolean or r->>'reason' <> 'creation_scope_changed' then raise exception 'Photo claim was reused as a Live Strip'; end if;
  r := public.finalize_strip_creation_for_mode(first_id, first_signature, 'pink-pop', 'strip-1x4', 'photo');
  if (r->>'allowed')::boolean then raise exception 'Claim was moved to another design'; end if;
  r := public.finalize_strip_creation_for_mode(first_id, 'v1:different-photo', 'classic', 'strip-1x4', 'photo');
  if (r->>'allowed')::boolean then raise exception 'A changed exported composition reused a claim'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_u, 'role', 'authenticated')::text, true);
  r := public.finalize_strip_creation_for_mode(first_id, first_signature, 'classic', 'strip-1x4', 'photo');
  if (r->>'allowed')::boolean or r->>'reason' <> 'unknown_creation' then raise exception 'Another account could use a claim'; end if;
  blocked := false;
  begin perform public.claim_strip_creation_for_mode('magazine', 'strip-1x4', 'photo');
    exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Paid design was not gated'; end if;
  blocked := false;
  begin perform public.claim_strip_creation_for_mode('classic', 'grid-2x2', 'live_strip');
    exception when insufficient_privilege then blocked := true; end;
  if not blocked then raise exception 'Paid layout was not gated'; end if;
  blocked := false;
  begin perform public.claim_strip_creation_for_mode('classic', 'strip-1x4', 'unknown');
    exception when invalid_parameter_value then blocked := true; end;
  if not blocked then raise exception 'Unknown media type was accepted'; end if;

  -- Old clients use the two-argument RPC and consume the same photo allowance.
  for n in 1..2 loop
    r := public.claim_strip_creation('polaroid', 'strip-1x4');
    if not (r->>'allowed')::boolean then raise exception 'Compatibility claim failed'; end if;
  end loop;
  r := public.claim_strip_creation_for_mode('polaroid', 'strip-1x4', 'photo');
  if (r->>'allowed')::boolean then raise exception 'Compatibility endpoint bypassed the per-mode limit'; end if;
  r := public.claim_strip_creation_for_mode('polaroid', 'strip-1x4', 'live_strip');
  if not (r->>'allowed')::boolean then raise exception 'Photo quota blocked Live Strips'; end if;

  insert into public.photostrip_creations (user_id, tier, template_id, layout_id)
    values (legacy_u, 'free', 'classic', 'strip-1x4'), (legacy_u, 'free', 'classic', 'strip-1x4');
  perform set_config('request.jwt.claims', jsonb_build_object('sub', legacy_u, 'role', 'authenticated')::text, true);
  r := public.claim_strip_creation_for_mode('classic', 'strip-1x4', 'photo');
  if (r->>'allowed')::boolean then raise exception 'Legacy photo usage was reset'; end if;
  r := public.claim_strip_creation_for_mode('classic', 'strip-1x4', 'live_strip');
  if not (r->>'allowed')::boolean then raise exception 'Legacy photos blocked new Live allowance'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', premium_u, 'role', 'authenticated')::text, true);
  for n in 1..6 loop
    r := public.claim_strip_creation_for_mode('magazine', 'grid-2x2', 'live_strip');
    if not (r->>'allowed')::boolean or not (r->>'unlimited')::boolean then raise exception 'Premium became limited'; end if;
  end loop;
  if has_function_privilege('anon', 'public.claim_strip_creation_for_mode(text,text,text)', 'EXECUTE') then raise exception 'Anonymous claims must be blocked'; end if;
  if has_function_privilege('anon', 'public.finalize_strip_creation_for_mode(uuid,text,text,text,text)', 'EXECUTE') then raise exception 'Anonymous exports must be blocked'; end if;
end $$;
select 'PASS: per-design/type limits, re-downloads, ownership, legacy counts and Premium access' as result;
rollback;
