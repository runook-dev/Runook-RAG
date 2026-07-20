#!/usr/bin/env bash
# Start (or restart) the RAGFlow engine stack + Caddy HTTPS proxy.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

if [[ ! -f engine.env ]]; then
  echo "Missing engine.env — copy engine.env.example and fill it in first." >&2
  exit 1
fi
# shellcheck disable=SC1091
set -a; source engine.env; set +a

RAGFLOW_DIR="$HERE/../ragflow"
# Clone if the engine source is missing OR the dir exists but is empty (the
# Runook-RAG repo gitignores ragflow/, so a bare empty dir can be left behind).
if [[ ! -f "$RAGFLOW_DIR/docker/docker-compose.yml" ]]; then
  echo "==> Cloning RAGFlow engine source"
  rm -rf "$RAGFLOW_DIR"
  git clone https://github.com/infiniflow/ragflow.git "$RAGFLOW_DIR"
fi

# Avoid git "dubious ownership" when this script runs under sudo (root) against
# a checkout owned by the ubuntu user.
git config --global --add safe.directory "$RAGFLOW_DIR" 2>/dev/null || true

echo "==> Pinning RAGFlow to ${RAGFLOW_IMAGE##*:}"
git -C "$RAGFLOW_DIR" fetch --tags --quiet || true
git -C "$RAGFLOW_DIR" checkout "${RAGFLOW_IMAGE##*:}" --quiet || \
  echo "   (tag checkout skipped; using current checkout)"

echo "==> Writing RAGFlow docker/.env overrides"
DOCKER_DIR="$RAGFLOW_DIR/docker"

# IMPORTANT: every service in RAGFlow's compose uses `env_file: .env` for its
# *container* environment, while `${VAR}` interpolation also defaults to `.env`.
# We must therefore apply our overrides to that one file — using a separate
# `--env-file` only changes interpolation, leaving the container env (e.g. the
# MySQL password the app reads back) pointing at the original `.env`, which
# causes "Access denied" mismatches. So: reset `.env` to pristine defaults,
# then edit it in place.
git -C "$RAGFLOW_DIR" checkout -- docker/.env 2>/dev/null || true

# Overrides applied directly to docker/.env. Internal service passwords (MySQL,
# MinIO, Redis, Elasticsearch) are intentionally left at RAGFlow's shipped
# defaults: they're only reachable on the private docker network / host
# loopback and are never exposed publicly (security group allows 443 + 22 only;
# Caddy proxies just the REST API on 9380).
set_env() {
  local key="$1" val="$2" file="$DOCKER_DIR/.env"
  if grep -qE "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >> "$file"
  fi
}
set_env RAGFLOW_IMAGE "$RAGFLOW_IMAGE"
set_env REGISTER_ENABLED "$REGISTER_ENABLED"
# Free host ports 80/443 for Caddy; remap RAGFlow's built-in web ports (never
# exposed via the security group).
set_env SVR_WEB_HTTP_PORT 8080
set_env SVR_WEB_HTTPS_PORT 8443

# Internal service passwords. docker/.env is the single source of truth: every
# service reads it via `env_file`, so the MySQL container init and the app read
# identical values. If engine.env provides values, pin them; otherwise keep
# whatever docker/.env already has (RAGFlow's shipped defaults).
#
# NOTE: MySQL/ES/MinIO persist their password in their data volume on first
# init. If you CHANGE a password after the first boot you must wipe that
# volume, or the service will reject the new password ("Access denied"):
#   docker compose -f ragflow/docker/docker-compose.yml down -v
# Shared LLM key (Google Gemini) made available to the container so
# provision_tenant.py can auto-configure Gemini for each new tenant.
[[ -n "${GEMINI_API_KEY:-}" ]] && set_env GEMINI_API_KEY "$GEMINI_API_KEY"

[[ -n "${MYSQL_PASSWORD:-}" ]] && set_env MYSQL_PASSWORD "$MYSQL_PASSWORD"
[[ -n "${MINIO_PASSWORD:-}" ]] && set_env MINIO_PASSWORD "$MINIO_PASSWORD"
[[ -n "${REDIS_PASSWORD:-}" ]] && set_env REDIS_PASSWORD "$REDIS_PASSWORD"
[[ -n "${ELASTIC_PASSWORD:-}" ]] && set_env ELASTIC_PASSWORD "$ELASTIC_PASSWORD"

# SMTP (transactional email: team invites, notifications). Interpolated into
# the service_conf smtp block below from the container env.
[[ -n "${SMTP_SERVER:-}" ]] && set_env SMTP_SERVER "$SMTP_SERVER"
[[ -n "${SMTP_PORT:-}" ]] && set_env SMTP_PORT "$SMTP_PORT"
[[ -n "${SMTP_USERNAME:-}" ]] && set_env SMTP_USERNAME "$SMTP_USERNAME"
[[ -n "${SMTP_PASSWORD:-}" ]] && set_env SMTP_PASSWORD "$SMTP_PASSWORD"
[[ -n "${SMTP_SENDER_EMAIL:-}" ]] && set_env SMTP_SENDER_EMAIL "$SMTP_SENDER_EMAIL"
[[ -n "${SMTP_FRONTEND_URL:-}" ]] && set_env SMTP_FRONTEND_URL "$SMTP_FRONTEND_URL"

# Agent code sandbox. Enabling adds a privileged executor container with access
# to the host docker socket (customer code runs in pooled containers).
if [[ "${SANDBOX_ENABLED:-0}" == "1" ]]; then
  set_env SANDBOX_ENABLED 1
  set_env SANDBOX_HOST sandbox-executor-manager
  # Activate the sandbox compose profile alongside the doc-engine + device ones.
  set_env COMPOSE_PROFILES "elasticsearch,cpu,sandbox"
fi

# ---------------------------------------------------------------------------
# Optional: Google (OIDC) login. Enabled when engine.env sets
# OAUTH_GOOGLE_CLIENT_ID / OAUTH_GOOGLE_CLIENT_SECRET. The container entrypoint
# interpolates ${...} in service_conf.yaml.template from the container env
# (which comes from docker/.env), so we push the creds there and append a
# google OIDC block to the template once (idempotent, guarded by a marker).
# ---------------------------------------------------------------------------
if [[ -n "${OAUTH_GOOGLE_CLIENT_ID:-}" && -n "${OAUTH_GOOGLE_CLIENT_SECRET:-}" ]]; then
  echo "==> Enabling Google (OIDC) login"
  set_env OAUTH_GOOGLE_CLIENT_ID "$OAUTH_GOOGLE_CLIENT_ID"
  set_env OAUTH_GOOGLE_CLIENT_SECRET "$OAUTH_GOOGLE_CLIENT_SECRET"
  OAUTH_REDIRECT="${OAUTH_GOOGLE_REDIRECT:-https://rag.runook.com/api/v1/auth/oauth/google/callback}"
  TPL="$DOCKER_DIR/service_conf.yaml.template"
  if ! grep -q "RUNOOK_OAUTH_BLOCK" "$TPL"; then
    cat >> "$TPL" <<YAML

# RUNOOK_OAUTH_BLOCK (managed by deploy/start-engine.sh) - do not duplicate
oauth:
  google:
    type: "oidc"
    icon: "google"
    display_name: "Google"
    client_id: "\${OAUTH_GOOGLE_CLIENT_ID}"
    client_secret: "\${OAUTH_GOOGLE_CLIENT_SECRET}"
    issuer: "https://accounts.google.com"
    scope: "openid email profile"
    redirect_uri: "${OAUTH_REDIRECT}"
YAML
    echo "   appended google oauth block to service_conf template"
  else
    echo "   oauth block already present in template"
  fi
fi

# ---------------------------------------------------------------------------
# Optional: SMTP for transactional email (team invites, notifications).
# Enabled when engine.env sets SMTP_SERVER. Appended once (idempotent).
# ---------------------------------------------------------------------------
if [[ -n "${SMTP_SERVER:-}" ]]; then
  echo "==> Enabling SMTP email"
  TPL="$DOCKER_DIR/service_conf.yaml.template"
  if ! grep -q "RUNOOK_SMTP_BLOCK" "$TPL"; then
    cat >> "$TPL" <<YAML

# RUNOOK_SMTP_BLOCK (managed by deploy/start-engine.sh) - do not duplicate
smtp:
  mail_server: "\${SMTP_SERVER}"
  mail_port: \${SMTP_PORT}
  mail_use_ssl: true
  mail_use_tls: false
  mail_username: "\${SMTP_USERNAME}"
  mail_password: "\${SMTP_PASSWORD}"
  mail_default_sender:
    - "Runook RAG"
    - "\${SMTP_SENDER_EMAIL}"
  mail_frontend_url: "\${SMTP_FRONTEND_URL}"
YAML
    echo "   appended smtp block to service_conf template"
  else
    echo "   smtp block already present in template"
  fi
fi

# Pre-pull sandbox images so the executor is ready when the profile starts.
if [[ "${SANDBOX_ENABLED:-0}" == "1" ]]; then
  echo "==> Pulling sandbox images"
  docker pull infiniflow/sandbox-executor-manager:latest || true
  docker pull infiniflow/sandbox-base-python:latest || true
  docker pull infiniflow/sandbox-base-nodejs:latest || true
fi

echo "==> Starting RAGFlow (docker compose)"
# --force-recreate ensures every container picks up the current docker/.env,
# rather than reusing a stale container created from an earlier env.
# RUNOOK_RESET=1 additionally wipes data volumes for a clean re-initialization
# (needed if internal passwords changed since the first boot).
if [[ "${RUNOOK_RESET:-0}" == "1" ]]; then
  echo "   RUNOOK_RESET=1 -> wiping data volumes for a clean init"
  docker compose -f "$DOCKER_DIR/docker-compose.yml" down -v --remove-orphans || true
fi
docker compose -f "$DOCKER_DIR/docker-compose.yml" up -d --force-recreate

# Install in-container management tools (they live in the container FS and are
# lost whenever the container is recreated, so (re)install on every start).
for t in provision_tenant.py quota_tool.py list_users.py; do
  [[ -f "$HERE/$t" ]] && docker cp "$HERE/$t" "docker-ragflow-cpu-1:/ragflow/$t" 2>/dev/null || true
done

echo "==> Configuring Caddy reverse proxy for $RAG_DOMAIN"
# RAGFlow's own nginx (host port 8080, from SVR_WEB_HTTP_PORT) serves the
# branded web UI AND proxies the REST API (/v1, /api). Pointing Caddy here
# gives customers the full Runook-branded product at one HTTPS hostname.
#
# RAG_DOMAIN is stored comma-separated (no spaces) so shell sourcing is safe;
# Caddy requires site addresses separated by ", " (comma + space).
CADDY_SITES=$(echo "$RAG_DOMAIN" | sed 's/,/, /g')
# Optional billing site (Runook billing service on :3100). Set BILLING_DOMAIN=""
# in engine.env to disable.
BILLING_DOMAIN="${BILLING_DOMAIN:-pay.runook.com}"
{
  echo "$CADDY_SITES {"
  # Same-origin Runook billing endpoints (e.g. /runook/plan for the tier badge).
  echo "    handle /runook/* {"
  echo "        reverse_proxy 127.0.0.1:3100"
  echo "    }"
  echo "    handle {"
  echo "        reverse_proxy 127.0.0.1:8080"
  echo "    }"
  echo "    request_body {"
  echo "        max_size 1GB"
  echo "    }"
  echo "}"
  if [[ -n "$BILLING_DOMAIN" ]]; then
    echo "$BILLING_DOMAIN {"
    echo "    reverse_proxy 127.0.0.1:3100"
    echo "}"
  fi
} | sudo tee /etc/caddy/Caddyfile >/dev/null
sudo systemctl reload caddy || sudo systemctl restart caddy

echo "==> Up. Open: https://$RAG_DOMAIN"
[[ -n "$BILLING_DOMAIN" ]] && echo "==> Billing: https://$BILLING_DOMAIN"
