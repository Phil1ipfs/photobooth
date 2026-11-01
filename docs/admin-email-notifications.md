# Admin email notifications

Recipient: **johncasingal63@gmail.com**. The server default and `.env.example` use this address; it is not exposed in the browser bundle.

The implementation queues future account creations (email and Google) and confirmed PayMongo Premium purchases/renewals. A Supabase Cron task checks the private queue every minute and calls the protected Vercel endpoint. Typical notification delay is approximately one minute plus provider delivery. Signup messages describe verification status **at account creation**, so an email signup may still be awaiting confirmation.

## Activate

1. Create a [Resend account](https://resend.com/signup) using **johncasingal63@gmail.com** and create an API key with permission to send emails. For an initial test to your own address, the default `PhotoBooth <onboarding@resend.dev>` sender works only when that Gmail is the Resend account owner's email. For production use, verify a sending domain and update the sender accordingly. [Resend sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
2. In Vercel → PhotoBooth → Settings → Environment Variables, set these for **Production**. Keep them server only (no `REACT_APP_` prefix):

   | Variable | Value |
   | --- | --- |
   | `RESEND_API_KEY` | Your private Resend API key |
   | `ADMIN_NOTIFICATION_SECRET` | A unique random secret, at least 32 characters |
   | `ADMIN_NOTIFICATION_EMAIL` | `johncasingal63@gmail.com` |
   | `ADMIN_NOTIFICATION_FROM` | Your verified sender, or `PhotoBooth <onboarding@resend.dev>` for the owner-only initial test |

   Existing `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` (or `REACT_APP_SUPABASE_URL`) are also required. Generate the notification secret locally, for example with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Do not paste any key or secret into chat.
3. Deploy the code and Vercel environment changes.
4. In Supabase → SQL Editor, run `supabase/migrations/011_admin_email_notifications.sql` after the existing migrations. It creates the queue and triggers; it does not send historical signup/payment notifications.
5. Open `supabase/setup_admin_email_scheduler.sql` in the SQL Editor. Replace its `v_secret` placeholder privately with the **same** `ADMIN_NOTIFICATION_SECRET` from Vercel, then run it. This installs/enables Supabase Cron, pg_net and Vault, stores the endpoint secret in Vault, and schedules the worker. Keep the repository file's placeholder unchanged.
6. Create one new test account through the website. Within about a minute, check Gmail (including Spam) and the Resend email log. A real paid Premium activation or renewal should then produce one corresponding payment alert. Do not make a real payment solely to test the email code; the automated tests use fixtures.

No Gmail password, app password or Gmail account connection is needed. Resend sends emails **to** Gmail. Delivery is not active until the sender credentials, database migration, schedule and endpoint deployment are configured.

## Reliability and security

- Signup and Premium payment paths perform only local database inserts. Network delivery is handled independently, so provider downtime does not interrupt those flows.
- Premium notifications originate from committed, server-written `premium_pass.paid` events after `grant_premium_pass` has updated the subscription. Both PayMongo webhooks and the success-page confirmation are covered. Unpaid checkouts never create this event. Repeated callbacks create only one queue event per payment.
- RLS and explicit grants prevent browser clients from reading, writing or claiming the queue. The endpoint accepts only a server secret and ignores client-supplied event/recipient data.
- Workers use exclusive leases, persist sent status, freeze the complete email request before delivery, and use a stable Resend idempotency key. Resend preserves these keys for 24 hours. Attempts older than 23 hours are moved to `needs_review` instead of risking duplicate sends. [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
- Network errors, rate limits and provider server errors retry with backoff. Other provider errors move to `failed`; check the sender configuration and provider logs before retrying. Secrets and email bodies are not logged by the endpoint.
- `sent` means the provider accepted the email, not that Gmail delivered it to Inbox. Check Resend for bounces or suppression. The queue contains customer email/name snapshots and should be treated as private admin data.

## Check delivery

Run privately in Supabase:

```sql
select id, kind, status, attempts, created_at, sent_at, last_error, provider_id
from public.admin_email_notifications
order by created_at desc limit 30;

select jobname, schedule, active
from cron.job where jobname = 'photobooth-admin-email';
```

After fixing a permanent configuration error, a job that never reached the provider can be requeued by its ID:

```sql
update public.admin_email_notifications
set status = 'pending', available_at = now(), first_attempt_at = null,
    delivery = null, attempts = 0, last_error = null
where id = 'REPLACE_WITH_NOTIFICATION_UUID' and status = 'failed';
```

For `needs_review`, first reconcile the event key against Resend logs. If an email was already accepted, mark it sent with its provider ID. Resetting an ambiguous job after the provider's 24-hour deduplication window could send a duplicate. Preserve the original frozen message when reconciling uncertain sends.

To stop delivery without removing events: `select cron.unschedule('photobooth-admin-email');`. Remove the Vercel sending key too if disabling the integration permanently.

Supabase [scheduled HTTP request pattern](https://supabase.com/docs/guides/functions/schedule-functions) and [Vault](https://supabase.com/docs/guides/database/vault) are used for server scheduling and secret storage.
