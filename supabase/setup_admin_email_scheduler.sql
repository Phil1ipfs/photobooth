-- Run ONCE after 011 and after deploying the endpoint with its Vercel secrets.
-- Edit v_secret BELOW privately in Supabase's SQL Editor. Never commit it.
-- This scheduler uses Supabase Cron, not Vercel Cron; no Vercel Pro requirement.
-- Re-running replaces the existing named schedule and updates its Vault secrets.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

do $$
declare
  v_secret text := 'REPLACE_WITH_YOUR_VERCEL_ADMIN_NOTIFICATION_SECRET';
  v_url text := 'https://photobooth-seven-sooty.vercel.app/api/notifications/dispatch';
  v_id uuid;
begin
  if v_secret like 'REPLACE_%' or length(v_secret) < 32 then
    raise exception 'First replace v_secret with the ADMIN_NOTIFICATION_SECRET set in Vercel.';
  end if;
  select id into v_id from vault.secrets where name = 'photobooth_admin_email_secret';
  if v_id is null then
    perform vault.create_secret(v_secret, 'photobooth_admin_email_secret');
  else
    perform vault.update_secret(v_id, v_secret);
  end if;
  select id into v_id from vault.secrets where name = 'photobooth_admin_email_url';
  if v_id is null then
    perform vault.create_secret(v_url, 'photobooth_admin_email_url');
  else
    perform vault.update_secret(v_id, v_url);
  end if;
end;
$$;

select cron.schedule('photobooth-admin-email', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'photobooth_admin_email_url'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'photobooth_admin_email_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  ) where exists (
    select 1 from public.admin_email_notifications
    where (status = 'pending' and available_at <= now())
       or (status = 'processing' and lease_until < now())
  );
$job$);
commit;
