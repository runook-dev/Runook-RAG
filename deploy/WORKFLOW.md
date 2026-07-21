# Runook RAG — build & iterate workflow

Runook RAG = the RAGFlow engine + a thin **Runook branding overlay**, shipped as
our own Docker image `runook-rag`. We keep RAGFlow itself essentially unmodified
so upstream updates stay easy to adopt.

```
branding/            # the entire Runook overlay (small, reviewable)
  logo.svg           # Runook logo (used for nav, favicon, login, chat avatar)
  favicon.ico
  apply-branding.sh  # patches a RAGFlow web checkout: logo, title, name, colors
deploy/
  Dockerfile.runook  # rebuilds branded web, layers onto official image
  build-image.sh     # one-click: apply branding + docker build runook-rag
  start-engine.sh    # runs the stack + Caddy HTTPS (serves branded UI + API)
  provision_tenant.py# create a customer tenant + API token inside the container
ragflow/             # upstream clone (gitignored; reference + build source)
```

## Three ways to work, fastest first

### 1. Fast UI iteration (seconds) — dev hot-reload

For tweaking branding/UI without rebuilding Docker. Run RAGFlow's web dev server
against the live engine API:

```bash
cd ragflow
bash ../branding/apply-branding.sh .     # apply Runook overlay to the checkout
cd web
npm install                              # first time only
# point the dev server at the running engine:
VITE_BASE_URL=https://rag-internal.runook.com npm run dev
# open http://localhost:5173  — edits hot-reload instantly
```

Adjust the overlay in `branding/` (or the files directly to experiment), see it
live, then fold the change back into `branding/apply-branding.sh`.

### 2. Build the branded image (a few minutes)

When the branding is where you want it:

```bash
bash deploy/build-image.sh local
# -> builds runook-rag:local (branded web layered on infiniflow/ragflow)
```

### 3. Ship it (on the EC2 engine host)

Preferred — **versioned release** (build a git-SHA-tagged image, promote it to
the running `runook-rag:local` tag, restart, keep history + prune old images):

```bash
cd Runook-RAG
git pull
sudo bash deploy/release.sh             # build runook-rag:<sha>, deploy, record history
```

Plain (unversioned) equivalent still works:

```bash
bash deploy/build-image.sh local
cd deploy && sudo bash start-engine.sh
```

No external CI pipeline; deploy is "build image + restart", fully under our
control. (The agent can run all of this remotely via AWS SSM on the EC2 host.)

### Rollback (seconds, no rebuild)

`release.sh` keeps the last few SHA-tagged images, so rollback is just
re-pointing `runook-rag:local` at a prior image and recreating the container:

```bash
sudo bash deploy/rollback.sh            # list available versions + history
sudo bash deploy/rollback.sh --prev     # roll back to the release before current
sudo bash deploy/rollback.sh <sha>      # roll back to a specific version
```

`deploy/.release-history` (per-host, gitignored) logs each release/rollback.
The running stack always uses the `runook-rag:local` tag — release/rollback
only change which built image that tag points to.

### Data safety (backups)

- **DynamoDB** (`runook-rag`): point-in-time recovery (PITR) is enabled — restore
  to any second in the last 35 days via the AWS console/CLI.
- **Engine volumes** (MySQL/ES/MinIO/Redis on the host EBS root volume): a daily
  EBS snapshot policy (AWS Data Lifecycle Manager) retains the last 7 days.
  A manual baseline snapshot can be taken anytime with
  `aws ec2 create-snapshot --volume-id <vol> --description runook-manual`.

### Secrets (SSM Parameter Store)

The runtime reads secrets from `deploy/engine.env` and `billing/.env.local`
(gitignored, on the host). Those files are also backed up — encrypted — to AWS
SSM Parameter Store under `/runook/engine/*` and `/runook/billing/*`, so they
survive host loss and can be rotated centrally. The host uses its instance-profile
role for access (no static keys on disk).

```bash
cd billing
# Back up current host secrets to SSM (run after any change):
node scripts/secrets-sync.mjs push ../deploy/engine.env /runook/engine
node scripts/secrets-sync.mjs push .env.local          /runook/billing
# Restore onto a fresh host (disaster recovery), then restart services:
node scripts/secrets-sync.mjs pull ../deploy/engine.env /runook/engine
node scripts/secrets-sync.mjs pull .env.local          /runook/billing
```

Rotation = update the value in SSM (or the file + push), `pull`, then restart the
affected service. The runtime never depends on SSM at boot, so a transient SSM
failure can't block startup.

## Staging environment (on-demand)

A prod-identical staging stack runs on its own EC2 host (`i-0fd6812849ce90513`,
t3.xlarge), reachable at **https://staging-rag.runook.com** and
**https://staging-pay.runook.com** (Elastic IP `54.152.15.159`). It uses its own
`runook-rag-staging` DynamoDB table and pulls config from SSM with staging
overrides (see `deploy/staging-bootstrap.sh`).

To save cost it is **start-on-demand** — start it before testing, stop it after:

```bash
bash deploy/staging.sh up       # start (~$0.17/hr while running)
bash deploy/staging.sh status
bash deploy/staging.sh down      # stop (only EBS + EIP billed when down)
```

Deploy a change to staging first (from your workstation via SSM, or on the host):

```bash
# on the staging host
cd /home/ubuntu/Runook-RAG && git pull && sudo bash deploy/release.sh
```

Console prerequisites for full staging parity (one-time, in the respective dashboards):

- **Stripe (test mode)**: add a webhook endpoint `https://staging-pay.runook.com/api/stripe/webhook`,
  copy its signing secret into staging `billing/.env.local` as `STRIPE_WEBHOOK_SECRET`
  (and use test-mode API keys), then restart `runook-billing`. Without this,
  login/KB/chat work but checkout won't provision.
- **Google OAuth**: add `https://staging-rag.runook.com/api/v1/auth/oauth/google/callback`
  as an authorized redirect URI. Without this, Google sign-in fails on staging
  (password login still works).

## Upgrading to a newer RAGFlow release

```bash
cd ragflow && git fetch --tags && git checkout vX.Y.Z && cd ..
# bump the base image tag used by the build:
RAGFLOW_IMAGE=infiniflow/ragflow:vX.Y.Z bash deploy/build-image.sh local
cd deploy && sudo bash start-engine.sh
```

`apply-branding.sh` re-applies cleanly on the new source. If upstream moved a
branded string/file, the script's `sed` for that spot becomes a no-op — check
the build output and update that one line in `apply-branding.sh`.

## What the overlay touches (for merge awareness)

- `web/public/logo.svg`, `web/public/favicon.ico`
- `web/index.html` (`<title>`), `web/src/conf.json` (`appName`)
- Hardcoded brand text: `login-next/index.tsx`, `admin/login.tsx`,
  `home/banner.tsx`, `next-search/ragflow-logo.tsx`, locale `admin.title`
- `web/tailwind.css` accent color + the two brand-gradient spots

Everything else in RAGFlow is untouched.
