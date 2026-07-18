# AWS setup checklist

What I (the agent) built vs. what needs a human in the AWS console. Items marked
**[you]** require console access / billing decisions I can't do from here. Items
marked **[agent]** I can do once you give me AWS CLI credentials locally
(`aws configure`), otherwise they're click-throughs for you.

---

## 1. DynamoDB table (portal storage)

**[you or agent]** Create one table:

- Table name: `runook-rag`
- Partition key: `PK` (String)
- Sort key: `SK` (String)
- Billing mode: On-demand (PAY_PER_REQUEST)
- TTL attribute: `ttl` (enables auto-expiry of sessions)

CLI (if you let me use AWS creds, I'll run this):

```bash
aws dynamodb create-table \
  --table-name runook-rag \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST
aws dynamodb update-time-to-live --table-name runook-rag \
  --time-to-live-specification "Enabled=true,AttributeName=ttl"
```

## 2. Amplify app for the portal

**[you]** In Amplify Console:

1. New app → Host web app → connect GitHub repo `runook-dev/Runook-RAG`,
   branch `main`.
2. Amplify auto-detects `portal/amplify.yml` (monorepo `appRoot: portal`). If it
   asks, set the app root to `portal`.
3. Environment variables (App settings → Environment variables):
   - `RAGFLOW_BASE_URL` = `https://rag-internal.runook.com`
   - `RAGFLOW_ADMIN_TOKEN` = (from RAGFlow after engine is up)
   - `RUNOOK_STORE` = `dynamo`
   - `RUNOOK_DDB_TABLE` = `runook-rag`
   - `RUNOOK_SESSION_SECRET` = (random 32+ chars)
   - `AWS_REGION` = `us-east-1` (or your region)
4. Custom domain: add `app.runook.com` (Amplify → Domain management). It creates
   the Route 53 records automatically since `runook.com` is already in Route 53.

**[you]** IAM: the Amplify SSR compute role needs DynamoDB access to the table.
Attach a policy allowing `dynamodb:GetItem/PutItem/UpdateItem/DeleteItem/Scan`
on `arn:aws:dynamodb:*:*:table/runook-rag`.

## 3. EC2 instance for the RAGFlow engine

**[you]** Launch:

- AMI: Ubuntu 24.04 LTS, arch **x86_64**
- Type: `t3.xlarge` (min) or `m6i.xlarge`
- Storage: 100 GB gp3
- Elastic IP: allocate + associate
- Security group inbound: `443` (0.0.0.0/0), `22` (your IP only). Nothing else.

**[you]** Route 53: A record `rag-internal.runook.com` → the Elastic IP.

**[you/me on the box]** SSH in and run `deploy/setup-ec2.sh` then
`deploy/start-engine.sh` (see `deploy/README.md`). I can write/adjust any script,
but running commands on the EC2 host happens over your SSH session.

## 4. LLM provider key

**[you]** Decide the model provider (OpenAI / DeepSeek / etc.) and put ONE
company key into RAGFlow (per-tenant cost is tracked in usage). Configured inside
RAGFlow after first boot (Model providers) or via `service_conf`.

---

## What's already done in this repo

- **[agent]** Portal app (login, dashboard, knowledge, chat) — builds clean.
- **[agent]** Gateway `/api/rag/*` with session auth, per-plan monthly quota,
  and usage metering into DynamoDB (or local file in dev).
- **[agent]** DynamoDB single-table data layer + local dev fallback.
- **[agent]** Customer provisioning script (`portal/scripts/create-customer.mjs`).
- **[agent]** EC2 deploy scripts + Caddy HTTPS config (`deploy/`).
- **[agent]** `portal/amplify.yml` for CI/CD identical in style to runook.com.

## What I still need from you to go further autonomously

1. **AWS credentials locally** (`aws configure` with an IAM user/role that can
   create DynamoDB tables + read Amplify) — then I can create the table and wire
   env vars via CLI instead of you clicking.
2. **The EC2 host up with SSH access** (or let me use AWS Systems Manager) — then
   I can run the engine deploy scripts and finish tenant provisioning.
3. **Chosen LLM provider + key** so I can complete the `provisionTenant()` flow
   in `portal/lib/ragflow.ts` against the live engine.
