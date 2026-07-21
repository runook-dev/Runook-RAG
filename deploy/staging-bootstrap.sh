#!/usr/bin/env bash
# Provision the Runook STAGING host end-to-end (run ON the staging host as root,
# via SSM). Reuses prod's secrets from SSM and overrides only what differs for
# staging (domains, DynamoDB table). Safe to re-run.
set -uo pipefail
export HOME=/root
REPO=/home/ubuntu/Runook-RAG

echo "==> [1/6] base packages (docker, compose, caddy)"
if [ ! -d "$REPO/.git" ]; then
  git clone https://github.com/runook-dev/Runook-RAG.git "$REPO"
fi
git config --global --add safe.directory "$REPO"
git -C "$REPO" pull --ff-only origin main 2>&1 | tail -1 || true
bash "$REPO/deploy/setup-ec2.sh"

echo "==> [2/7] Node.js 20 (needed for SSM config pull + billing)"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> [3/7] pull config from SSM (prod values)"
cd "$REPO/billing"
npm install --no-audit --no-fund 2>&1 | tail -1
node scripts/secrets-sync.mjs pull "$REPO/deploy/engine.env" /runook/engine
node scripts/secrets-sync.mjs pull "$REPO/billing/.env.local" /runook/billing
# Sanity: the engine env must contain the image tag or start-engine will fail.
grep -q '^RAGFLOW_IMAGE=' "$REPO/deploy/engine.env" || { echo "FATAL: engine.env missing RAGFLOW_IMAGE (SSM pull failed)"; exit 1; }

echo "==> [4/7] apply staging overrides"
E="$REPO/deploy/engine.env"; B="$REPO/billing/.env.local"
set_kv() { local f="$1" k="$2" v="$3"; grep -q "^${k}=" "$f" && sed -i "s#^${k}=.*#${k}=${v}#" "$f" || echo "${k}=${v}" >> "$f"; }
set_kv "$E" RAG_DOMAIN staging-rag.runook.com
set_kv "$E" BILLING_DOMAIN staging-pay.runook.com
set_kv "$E" OAUTH_GOOGLE_REDIRECT https://staging-rag.runook.com/api/v1/auth/oauth/google/callback
set_kv "$B" RUNOOK_DDB_TABLE runook-rag-staging
set_kv "$B" BILLING_BASE_URL https://staging-pay.runook.com
set_kv "$B" APP_URL https://staging-rag.runook.com

echo "==> [5/7] build branded image"
bash "$REPO/deploy/build-image.sh" local 2>&1 | tail -6

echo "==> [6/7] start engine + Caddy"
cd "$REPO/deploy" && bash start-engine.sh 2>&1 | tail -6

echo "==> [7/7] billing + monitoring"
bash "$REPO/deploy/setup-billing.sh" 2>&1 | tail -3 || true
bash "$REPO/deploy/setup-monitoring.sh" 2>&1 | tail -2 || true

echo "==> STAGING BOOTSTRAP DONE -> https://staging-rag.runook.com"
