# Superb Creations Production Readiness

## Required Environment

Set these in Vercel and local production-like environments:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `CRON_SECRET`

Optional webhook tokens:

- `BREVO_WEBHOOK_TOKEN`
- `SHIPPING_WEBHOOK_TOKEN`

## Cron

Create a Vercel Cron or Supabase scheduled HTTP call:

`POST https://<domain>/api/admin/cron/run?task=all`

Send either:

- `Authorization: Bearer <CRON_SECRET>`
- or `x-cron-secret: <CRON_SECRET>`

Safe task names:

- `expire_due_manual_payment_orders`
- `process_email_queue`
- `generate_daily_analytics_snapshot`
- `sync_shipment_statuses`
- `cleanup_old_events`
- `check_system_health`
- `all`

## Webhooks

Razorpay:

- URL: `https://<domain>/api/public/webhooks/razorpay`
- Secret: `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured`, `payment.failed`, `order.paid`

Brevo:

- URL: `https://<domain>/api/public/webhooks/brevo`
- Add `x-webhook-token: <BREVO_WEBHOOK_TOKEN>` if configured.

Shipping provider:

- URL: `https://<domain>/api/public/webhooks/shipping`
- Add `x-webhook-token: <SHIPPING_WEBHOOK_TOKEN>` if configured.

## Backup Checklist

- Enable Supabase PITR or scheduled database backups for the production project.
- Export a full SQL backup before every schema phase.
- Back up Storage buckets: `product-images`, `lookbook-images`, `business-media`, `payment-screenshots`.
- Keep a secure copy of Vercel env vars outside the repo.
- Record Razorpay webhook secret rotation dates.
- Record Brevo sender/domain verification status.

## Restore Checklist

- Restore database backup to a staging Supabase project first.
- Restore storage buckets before traffic is pointed at the restored database.
- Apply only migrations newer than the backup timestamp.
- Verify admin login with `superbcreations55@gmail.com`.
- Verify checkout: UPI, COD, bank transfer, and Razorpay.
- Verify webhook signatures and cron endpoint after restore.

## Operational Checks

- Admin -> System: check unresolved errors, audit logs, cron runs, and email queue.
- Admin -> Orders: review pending payment verifications daily.
- Admin -> Settings: confirm public contact/payment/social settings.
- Supabase: monitor API errors, storage usage, and auth provider status.
- Vercel: monitor function errors and deployment alias consistency.

## Performance Notes

- The logo asset is large; optimize it before heavy production traffic.
- Admin routes are intentionally feature-rich and larger than storefront pages.
- Keep public data reads on `publicSupabase` so auth state cannot change storefront data.
- Prefer paginated admin queries for growing order/customer datasets.
