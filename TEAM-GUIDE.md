# Runook RAG — Team Guide

Onboarding + operations manual for developing, deploying, and maintaining
**Runook RAG**. Read this end‑to‑end once; keep it open as a reference.

> Runook RAG = the open‑source **RAGFlow** engine, wrapped in a thin Runook
> **branding overlay**, plus our own **billing / access‑control layer**. We keep
> RAGFlow essentially unmodified so upstream upgrades stay easy.

For a visual architecture review see the canvas
`canvases/runook-rag-system-audit.canvas.tsx`; deploy specifics live in
`deploy/WORKFLOW.md`; billing specifics in `billing/BILLING.md`.

---

## 1. System at a glance

```
Browser
  │  HTTPS
  ▼
Caddy (:80/:443, auto-TLS)         ── one per host ──
  ├── /runook/*   → billing service (:3100)   (same-origin plan/usage/invoices)
  ├── /*          → RAGFlow web+API (:8080 → :9380)
  └── pay.runook.com → billing service (:3100)
                          │
RAGFlow engine (Docker Compose): ragflow-cpu + MySQL + Elasticsearch + MinIO + Redis (+ sandbox pool)
Billing (Next.js, systemd): Stripe + DynamoDB + admin console + reconcile job
```

- **Frontend**: RAGFlow's own web, rebranded at build time (logo, colors, name,
  Billing page, plan badge). Baked into the `runook-rag` Docker image.
- **Backend/engine**: unmodified RAGFlow (`infiniflow/ragflow:v0.26.4`).
- **Billing/access**: our Next.js app (`billing/`) — pricing, Stripe checkout,
  admin console, and an hourly reconcile that suspends unpaid/over‑quota users.
- **Data**: RAGFlow data in Docker volumes (MySQL/ES/MinIO/Redis); billing +
  access data in DynamoDB.

---

## 2. Environments

| | Production | Staging |
|---|---|---|
| Product URL | https://rag.runook.com | https://staging-rag.runook.com |
| Billing URL | https://pay.runook.com | https://staging-pay.runook.com |
| EC2 instance | `i-0aed99c285de295b3` | `i-0fd6812849ce90513` |
| Public IP | 44.213.154.112 | 54.152.15.159 (Elastic IP) |
| DynamoDB table | `runook-rag` | `runook-rag-staging` |
| Always on? | Yes | **No — start on demand** |
| Region / account | us-east-1 / 271443695007 | same |

**Golden rule: test on staging first, then promote to prod.** Never debug on prod.

---

## 3. What each person needs (access checklist)

Give every developer:

1. **GitHub** write access to `runook-dev/Runook-RAG`.
2. **AWS IAM user** in account `271443695007` (us-east-1) with at least:
   EC2 (describe/start/stop), SSM (SendCommand/GetCommandInvocation/StartSession),
   DynamoDB (on the two tables), CloudWatch/SNS read, and SSM Parameter Store read
   on `/runook/*`. Then `aws configure` locally.
3. **Session Manager plugin** for shell access to hosts (no SSH keys needed):
   `aws ssm start-session --target <instance-id>`.
4. **Stripe** dashboard access (test mode for staging, live for prod).
5. **Google Cloud Console** access to the OAuth client (for redirect URIs).
6. **Route53** access (only for DNS changes).

Secrets themselves are **not** in git. They live on each host in
`deploy/engine.env` + `billing/.env.local`, and are backed up (encrypted) in
SSM Parameter Store under `/runook/engine/*` and `/runook/billing/*`.

---

## 4. Repository layout

| Path | What it is | Where it runs |
|---|---|---|
| `branding/` | Runook overlay: `apply-branding.sh`, logo, `billing-page.tsx`, `plan-badge.tsx` | Baked into the Docker image |
| `deploy/` | All ops scripts + in-container Python tools | On the EC2 hosts (via SSM) |
| `billing/` | Next.js billing + admin + reconcile service | systemd `runook-billing` (:3100) |
| `ragflow/` | Upstream RAGFlow clone (gitignored) — build source + reference | Cloned on host, pinned to the image version |
| `portal/` | **Deprecated** first-attempt custom portal — ignore | Not deployed |

Key `deploy/` scripts:

| Script | Purpose |
|---|---|
| `setup-ec2.sh` | Install Docker + Compose + Caddy on a fresh host |
| `build-image.sh` | Apply branding + build `runook-rag:<tag>` (pins ragflow source to the base image version) |
| `start-engine.sh` | Start/restart the engine stack + write the Caddyfile |
| `release.sh` | **Versioned deploy**: build SHA-tagged image, promote, restart, prune |
| `rollback.sh` | **Fast rollback** to a prior image (no rebuild) |
| `setup-billing.sh` | Install/run the billing systemd service + hourly reconcile timer |
| `setup-monitoring.sh` | Install the self-heal watchdog timer |
| `setup-sandbox.sh` | Install gVisor for Agent code execution (optional) |
| `staging.sh` | `up` / `down` / `status` for the on-demand staging host |
| `staging-bootstrap.sh` | Provision a staging host end-to-end |
| `provision_tenant.py`, `quota_tool.py`, `list_users.py` | In-container tenant/quota/user tools |

Key `billing/` pieces: `app/` (pricing, admin, `/runook/*` same-origin APIs,
Stripe webhook), `lib/` (plans, store, roster, allowlist, stripe, metrics),
`scripts/` (`reconcile-accounts.mjs`, `secrets-sync.mjs`, ...).

---

## 5. Local development

```bash
# Billing / admin UI (uses a local JSON store, no AWS needed):
cd billing
npm install
RUNOOK_STORE=local npm run dev        # http://localhost:3100

# Branding / RAGFlow UI hot-reload against the live engine:
cd ragflow && bash ../branding/apply-branding.sh .
cd web && npm install
VITE_BASE_URL=https://rag-internal.runook.com npm run dev   # http://localhost:5173
```

Always run `npm run typecheck` / `npm run lint` in `billing/` before pushing.
Edit branding by changing files in `branding/` (fold experiments back into
`apply-branding.sh` so they survive a rebuild).

---

## 6. Development workflow (dev → staging → prod)

1. **Branch** off `main`, make changes, open a **PR** into `main`.
2. Merge to `main` after review.
3. **Deploy to staging** and test:
   ```bash
   bash deploy/staging.sh up
   aws ssm start-session --target i-0fd6812849ce90513
   #   on the host:
   cd /home/ubuntu/Runook-RAG && git pull && sudo bash deploy/release.sh
   # test at https://staging-rag.runook.com, then:
   bash deploy/staging.sh down          # stop billing when done
   ```
4. **Promote to prod** once staging looks good:
   ```bash
   aws ssm start-session --target i-0aed99c285de295b3
   cd /home/ubuntu/Runook-RAG && git pull && sudo bash deploy/release.sh
   ```
5. If prod misbehaves, **roll back in seconds** (§7).

Frontend/branding changes → `release.sh` (rebuilds image). Billing‑only changes →
`cd billing && npm ci && npm run build && sudo systemctl restart runook-billing`.

---

## 7. Deploy & rollback

**Deploy (versioned):**
```bash
sudo bash deploy/release.sh     # builds runook-rag:<gitsha>, promotes to :local, restarts, prunes
```

**Rollback (no rebuild, seconds):**
```bash
sudo bash deploy/rollback.sh            # list available versions + history
sudo bash deploy/rollback.sh --prev     # to the release before current
sudo bash deploy/rollback.sh <sha>      # to a specific version
```

The running stack always uses the tag `runook-rag:local`; release/rollback just
change which built image that tag points at. History is in
`deploy/.release-history` (per host).

---

## 8. Operations & maintenance

### Monitoring & alerts
- **SNS topic** `runook-alerts` → emails `info@runook.com` (confirmed).
- CloudWatch alarms: `runook-ec2-instance-status`, `runook-ec2-system-status`
  (host down), `runook-uptime-rag`, `runook-uptime-pay` (site unreachable, via
  Route53 health checks). All fire to SNS.
- **Watchdog** (`runook-watchdog.timer`, every 2 min) auto‑restarts a crashed
  engine/billing/Caddy. Log: `/var/log/runook-watchdog.log`.

### Backups & restore
- **DynamoDB**: point‑in‑time recovery is ON for both tables (restore to any
  second in the last 35 days via console/CLI).
- **Engine volumes**: daily EBS snapshots via DLM policy `policy-09dc7ee789d43c9f1`
  (retain 7 days). Manual snapshot:
  `aws ec2 create-snapshot --volume-id <vol> --description runook-manual`.
- **Restore** an engine host from a snapshot: create a volume from the snapshot,
  attach to a new instance, or roll the root volume — then re‑run the stack.

### Secrets (SSM Parameter Store)
```bash
cd billing
# after changing a secret on a host, back it up:
node scripts/secrets-sync.mjs push ../deploy/engine.env /runook/engine
node scripts/secrets-sync.mjs push .env.local          /runook/billing
# rebuild a host's env from SSM (disaster recovery), then restart services:
node scripts/secrets-sync.mjs pull ../deploy/engine.env /runook/engine
node scripts/secrets-sync.mjs pull .env.local          /runook/billing
```
Rotation = change value in SSM (or file + push) → `pull` → restart the service.

---

## 9. Runbook — common tasks

**Shell into a host** (no SSH keys; uses SSM):
```bash
aws ssm start-session --target i-0aed99c285de295b3     # prod
aws ssm start-session --target i-0fd6812849ce90513     # staging (start it first)
```

**Admin console** (open/suspend/reactivate accounts, set plans):
`https://pay.runook.com/admin` (staff session login).

**Open a customer manually** (inside the engine container):
```bash
docker exec docker-ragflow-cpu-1 /ragflow/.venv/bin/python \
  /ragflow/provision_tenant.py --email a@b.com --nickname "Acme" --password 'secret'
```

**List users / check quota** (inside container):
```bash
docker exec docker-ragflow-cpu-1 /ragflow/.venv/bin/python /ragflow/list_users.py
docker exec docker-ragflow-cpu-1 /ragflow/.venv/bin/python /ragflow/quota_tool.py metrics <tenant_id>
```

**Run access reconcile now** (normally hourly):
```bash
cd /home/ubuntu/Runook-RAG/billing && node scripts/reconcile-accounts.mjs
```

**View logs / restart services:**
```bash
docker logs -f docker-ragflow-cpu-1                 # engine
journalctl -u runook-billing -f                     # billing
sudo systemctl restart runook-billing               # restart billing
docker compose -f ragflow/docker/docker-compose.yml restart ragflow-cpu   # restart engine only
```

**Upgrade RAGFlow version:** bump the base image in `build-image.sh`
(`RAGFLOW_IMAGE=infiniflow/ragflow:vX.Y.Z`), `release.sh`, test on staging first.

---

## 10. Safety rules (read before touching prod)

- **Never** debug on prod first — use staging.
- **Never** force‑push `main`; open PRs.
- **Do not** change internal service passwords (MySQL/ES/MinIO/Redis) after first
  boot — the volume persists the original and you'll get `Access denied`. If you
  must, wipe the volume with `RUNOOK_RESET=1` (⚠️ **deletes all engine data**).
- `RUNOOK_RESET=1 bash start-engine.sh` **wipes all engine data volumes** — only
  ever on a fresh/empty host or when you intend to erase everything.
- Never commit secrets. `engine.env`, `.env.local`, and `deploy/.release-history`
  are gitignored — keep it that way.
- Stop staging (`deploy/staging.sh down`) when you finish testing.

---

## 11. Troubleshooting (known gotchas)

| Symptom | Cause | Fix |
|---|---|---|
| `502` on the product URL | Engine still booting (waits for MySQL, ~1–2 min) or crash-loop | Wait; if it persists, `docker inspect -f '{{.RestartCount}}' docker-ragflow-cpu-1` and check `docker logs` |
| Engine crash-loops, `restarts` climbing | `ragflow/` checkout version ≠ image version (compose/config drift) | `build-image.sh` now auto-pins; ensure the checkout matches the base image tag |
| MySQL `Access denied for user 'root'` | Password in `docker/.env` ≠ password persisted in the MySQL volume | On a data-less host: `RUNOOK_RESET=1 bash start-engine.sh`; otherwise restore the original password |
| Google login fails on staging | Redirect URI not whitelisted | Add `https://staging-rag.runook.com/api/v1/auth/oauth/google/callback` in Google console |
| Checkout doesn't provision on staging | No staging Stripe webhook | Add webhook `https://staging-pay.runook.com/api/stripe/webhook` (test mode), set its secret in staging `.env.local` |
| Admin plan change "reverts" | Reconcile precedence | Admin overrides in the allowlist are authoritative; confirm the override was set |

---

## 12. Cost overview (rough, us-east-1)

- **Prod** t3.xlarge always-on + 100 GB gp3 ≈ **$130/mo**.
- **Staging** t3.xlarge start-on-demand: ~**$10–15/mo** idle (EBS + EIP) + $0.17/hr while up.
- DynamoDB (on-demand), SSM, SNS, CloudWatch, Route53 health checks: a few $/mo total.
- EBS snapshots: proportional to changed data (small).

---

## 13. Key resource reference

| Resource | ID / name |
|---|---|
| AWS account / region | 271443695007 / us-east-1 |
| Prod / staging EC2 | `i-0aed99c285de295b3` / `i-0fd6812849ce90513` |
| Staging Elastic IP | 54.152.15.159 (`eipalloc-0cb6ee80736c13913`) |
| DynamoDB tables | `runook-rag`, `runook-rag-staging` |
| Instance IAM profile | `runook-rag-ec2-ssm` |
| SNS alert topic | `arn:aws:sns:us-east-1:271443695007:runook-alerts` |
| CloudWatch alarms | `runook-ec2-instance-status`, `runook-ec2-system-status`, `runook-uptime-rag`, `runook-uptime-pay` |
| EBS snapshot policy (DLM) | `policy-09dc7ee789d43c9f1` (daily, retain 7) |
| Route53 hosted zone | `Z0396607S3WVJYH4A7J7` (runook.com) |
| SSM secret prefixes | `/runook/engine/*`, `/runook/billing/*` |
| Systemd units (hosts) | `caddy`, `runook-billing`, `runook-quota.timer`, `runook-watchdog.timer` |
