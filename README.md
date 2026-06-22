# Superb Creations

TanStack Start + Supabase e-commerce storefront.

## Package Manager

Use npm only for this repo:

```bash
npm install
npm run build
npm run lint
```

Do not add Bun, pnpm, or Yarn lock files.

## Environment Variables

Create a local `.env` from `.env.example` and set the same values in Vercel.
Do not commit `.env` or real secrets.

Required Supabase values:

```bash
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-anon-or-publishable-key"
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-supabase-anon-or-publishable-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
```

Razorpay:

```bash
RAZORPAY_KEY_ID="rzp_live_or_test_key_id"
RAZORPAY_KEY_SECRET="your-razorpay-key-secret"
RAZORPAY_WEBHOOK_SECRET="your-razorpay-webhook-secret"
```

Resend:

```bash
RESEND_API_KEY="re_your_resend_api_key"
RESEND_FROM="Superb Creations <orders@your-verified-domain.com>"
ADMIN_EMAIL="owner@example.com"
SITE_URL="https://www.your-domain.com"
```

`RESEND_API_KEY` is server-only. If `RESEND_FROM` is not set, email sending is skipped with a server log until a verified Resend sender/domain is ready.

## Supabase Setup

1. Create a fresh Supabase project.
2. Copy the project API URL, publishable/anon key, and service role key into `.env` and Vercel.
3. Link the Supabase CLI to the project if you use CLI deploys:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

The migrations create the public tables, RLS policies, stock/payment RPCs, Razorpay webhook event table, and the `product-images` storage bucket. Product image uploads use the `product-images` bucket and are restricted to admin users by RLS policies.

## Production Checklist

- Admin access is intentionally limited to `superbcreations55@gmail.com`. Do not add client-side role assignment, signup metadata role checks, or public APIs that can grant admin.
- Apply all Supabase migrations before launch. The latest migrations revoke public order inserts, force owner-email admin checks, create `product-images`, and restrict product/order/review/storage writes with RLS.
- Confirm the owner can sign in with `superbcreations55@gmail.com` before adding products.
- Replace placeholder legal/business details in Privacy, Terms, Shipping, Return/Refund and Support pages.
- Set `SITE_URL` in Vercel so `sitemap.xml` and `robots.txt` produce absolute production URLs.
- Verify Razorpay webhook delivery in the Razorpay dashboard after deployment.
- Verify Resend sender/domain. `RESEND_FROM` must not be `onboarding@resend.dev` for production email.
- Monitor Supabase `orders` as the admin notification fallback until production email is confirmed.

## Vercel Deployment

1. Import the repository into Vercel.
2. Keep the install command as `npm install`.
3. Keep the build command as `npm run build`.
4. Set all environment variables listed above.
5. Deploy.

The build script sets `NITRO_PRESET=vercel`, and `vite.config.ts` configures Nitro for Vercel output.

## Razorpay Webhook

Configure this webhook in Razorpay:

```text
URL: https://your-domain.com/api/public/webhooks/razorpay
Events: payment.captured, payment.failed, order.paid
Secret: same value as RAZORPAY_WEBHOOK_SECRET
```

Orders are created server-side from Supabase product/variant data. The client never supplies trusted prices, totals, or stock. Stock is deducted only after verified Razorpay payment, or when an admin confirms a WhatsApp/COD order.
