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
[[ -n "${MYSQL_PASSWORD:-}" ]] && set_env MYSQL_PASSWORD "$MYSQL_PASSWORD"
[[ -n "${MINIO_PASSWORD:-}" ]] && set_env MINIO_PASSWORD "$MINIO_PASSWORD"
[[ -n "${REDIS_PASSWORD:-}" ]] && set_env REDIS_PASSWORD "$REDIS_PASSWORD"
[[ -n "${ELASTIC_PASSWORD:-}" ]] && set_env ELASTIC_PASSWORD "$ELASTIC_PASSWORD"

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

echo "==> Configuring Caddy reverse proxy for $RAG_DOMAIN"
# RAGFlow's own nginx (host port 8080, from SVR_WEB_HTTP_PORT) serves the
# branded web UI AND proxies the REST API (/v1, /api). Pointing Caddy here
# gives customers the full Runook-branded product at one HTTPS hostname.
#
# RAG_DOMAIN is stored comma-separated (no spaces) so shell sourcing is safe;
# Caddy requires site addresses separated by ", " (comma + space).
CADDY_SITES=$(echo "$RAG_DOMAIN" | sed 's/,/, /g')
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$CADDY_SITES {
    reverse_proxy 127.0.0.1:8080

    # Allow large document uploads.
    request_body {
        max_size 1GB
    }
}
EOF
sudo systemctl reload caddy || sudo systemctl restart caddy

echo "==> Up. Open: https://$RAG_DOMAIN"
