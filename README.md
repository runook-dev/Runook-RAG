# Runook RAG

Runook-branded Retrieval-Augmented Generation, sold to customers as a metered
service. Customers only ever see the Runook UI and a Runook login; the
underlying engine ([RAGFlow](https://github.com/infiniflow/ragflow), Apache-2.0)
runs privately and is never exposed to them.

## Architecture

```
Customer browser
  → app.runook.com            Next.js portal on AWS Amplify (Runook brand)
  → /api/rag/* gateway        auth (cookie session) + monthly quota + usage metering
  → rag-internal.runook.com   Caddy HTTPS on EC2
  → RAGFlow /api/v1           docker compose: engine + MySQL + Elasticsearch + MinIO + Redis
  → LLM / embedding provider  your API key, cost attributed per tenant
```

- **One customer = one RAGFlow tenant.** Data is isolated by `tenant_id`; each
  customer gets a tenant-scoped RAGFlow API token that stays server-side.
- **Usage control lives in the portal gateway**, not in RAGFlow (its built-in
  `credit`/`used_tokens` fields exist but aren't enforced). The gateway checks a
  monthly token allowance per plan and records consumption after each call.

## Repository layout

| Path        | What it is                                                        |
|-------------|-------------------------------------------------------------------|
| `portal/`   | Next.js 16 customer portal + gateway API (deploys to Amplify)     |
| `deploy/`   | EC2 scripts to run the RAGFlow engine behind Caddy HTTPS          |
| `ragflow/`  | Upstream RAGFlow clone — reference only, **gitignored**           |

## Portal (local dev)

```bash
cd portal
npm install
cp .env.example .env.local          # set RUNOOK_SESSION_SECRET at minimum
# create a test customer in the local file store:
node scripts/create-customer.mjs --email you@acme.com --name Acme --plan starter --password secret
npm run dev                          # http://localhost:3000
```

With `RUNOOK_STORE=local` (default in dev) everything runs without AWS. Point
`RAGFLOW_BASE_URL` at a running engine to exercise the RAG features.

## Plans & quotas

Defined in `portal/lib/config.ts` (`PLAN_LIMITS`): `trial` 100K, `starter` 2M,
`pro` 20M monthly tokens, `enterprise` unlimited. Metered endpoints (chat,
completions, retrieval, agents) are gated; over-limit requests return HTTP 429.

## Deployment

- **Portal** → AWS Amplify, connected to this GitHub repo, `appRoot: portal`
  (see `portal/amplify.yml`). Push to `main` deploys production.
- **Engine** → EC2 via `deploy/` (see `deploy/README.md`).

See [`SETUP-AWS.md`](./SETUP-AWS.md) for the exact AWS console checklist.
