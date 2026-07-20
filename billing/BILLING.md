# Runook RAG — billing layer (Option A)

A small Next.js service that sits *beside* the RAGFlow engine and handles the
commercial layer RAGFlow itself lacks: pricing, Stripe checkout, tenant
provisioning, an admin dashboard, and monthly quota enforcement.

```
Customer → pay.runook.com (this service)
  → /                 pricing page (Trial / Starter / Growth / Business / Enterprise)
  → /api/checkout     Stripe Checkout session
  → Stripe hosted checkout (test card 4242 4242 4242 4242)
  → /api/stripe/webhook  on success: provision RAGFlow tenant + store plan
  → customer signs in at rag.runook.com (Google or emailed temp password)
Runook staff → pay.runook.com/admin?token=…   customers / plans / MRR
Cron (hourly) → scripts/enforce-quota.mjs → suspend/reactivate over-quota tenants
```

Data lives in the shared DynamoDB table `runook-rag` (BILL#/STRIPE#/BEMAIL# keys).

## Why it runs on the EC2 host (not a container)

Provisioning and quota enforcement call `provision_tenant.py` / `quota_tool.py`
**inside** the RAGFlow container via `docker exec`, so the billing process needs
access to the host Docker socket. Simplest: run it as a host Node process under
systemd, with Caddy proxying `pay.runook.com` to `127.0.0.1:3100`.

## One-time deploy (on the EC2 host)

1. **Stripe products/prices** already created (lookup keys
   `runook_{starter,growth,business}_monthly`).

2. **Webhook**: Stripe Dashboard → Developers → Webhooks → add endpoint
   `https://pay.runook.com/api/stripe/webhook`, events:
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`. Copy the signing
   secret (`whsec_…`).

3. **Env** — create `billing/.env.local` (or export in the systemd unit):
   ```
   STRIPE_SECRET_KEY=sk_test_…
   STRIPE_PUBLISHABLE_KEY=pk_test_…
   STRIPE_WEBHOOK_SECRET=whsec_…
   BILLING_BASE_URL=https://pay.runook.com
   APP_URL=https://rag.runook.com
   RAGFLOW_CONTAINER=docker-ragflow-cpu-1
   RUNOOK_STORE=dynamo
   RUNOOK_DDB_TABLE=runook-rag
   AWS_REGION=us-east-1
   RUNOOK_ADMIN_DASH_TOKEN=<random>
   ```
   The host also needs AWS credentials with DynamoDB access to `runook-rag`
   (instance role or `~/.aws`).

4. **Copy the in-container tools** into the RAGFlow container (done by the
   deploy script): `provision_tenant.py`, `quota_tool.py`.

5. **Run**: `npm ci && npm run build && npm start` (port 3100) under systemd.

6. **Caddy**: add a site block for `pay.runook.com` → `reverse_proxy 127.0.0.1:3100`
   and point `pay.runook.com` (Route 53 A record) at the Elastic IP.

7. **Quota cron**: systemd timer or crontab running
   `node scripts/enforce-quota.mjs` hourly.

## Go-live checklist (switch from test to live)

- Complete Stripe business activation (bank + tax).
- Swap `sk_test_/pk_test_` for live keys, recreate the webhook in live mode,
  update `STRIPE_WEBHOOK_SECRET`.
- Verify a real subscription end-to-end, then a cancellation.

## Known TODOs (validate on first deploy)

- `quota_tool.py` uses cumulative `used_tokens` as the usage proxy; wire a
  monthly baseline/reset for accurate per-cycle limits.
- Email delivery of login details (Resend) is stubbed in the webhook.
- Seats/storage/knowledge-base limits are displayed but only credits are
  currently enforced.
