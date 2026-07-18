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

echo "==> Starting RAGFlow (docker compose)"
docker compose -f "$DOCKER_DIR/docker-compose.yml" up -d

echo "==> Configuring Caddy reverse proxy for $RAG_DOMAIN"
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$RAG_DOMAIN {
    # RAGFlow REST API (/api/v1) is served on host port 9380 (SVR_HTTP_PORT).
    reverse_proxy 127.0.0.1:9380
}
EOF
sudo systemctl reload caddy || sudo systemctl restart caddy

echo "==> Up. Check: curl -sk https://$RAG_DOMAIN/api/v1/system/config"
