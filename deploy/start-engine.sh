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
# Our overrides. Keys here replace whatever RAGFlow ships in docker/.env.
# Note: RAGFlow reuses MYSQL_PASSWORD as MYSQL_ROOT_PASSWORD, so it must be
# consistent between the mysql container init and the ragflow server.
declare -a OVERRIDES=(
  "RAGFLOW_IMAGE=$RAGFLOW_IMAGE"
  "MYSQL_PASSWORD=$MYSQL_PASSWORD"
  "MINIO_PASSWORD=$MINIO_PASSWORD"
  "REDIS_PASSWORD=$REDIS_PASSWORD"
  "ELASTIC_PASSWORD=$ELASTIC_PASSWORD"
  "REGISTER_ENABLED=$REGISTER_ENABLED"
  # Free host ports 80/443 for Caddy; remap RAGFlow's built-in web ports.
  # We only proxy the REST API (9380) publicly; the web UI ports are never
  # exposed via the security group.
  "SVR_WEB_HTTP_PORT=8080"
  "SVR_WEB_HTTPS_PORT=8443"
)

# Build a deterministic merged env: start from RAGFlow's shipped .env with our
# overridden keys stripped out, then append our values. This avoids duplicate
# keys whose precedence differs across docker compose versions.
OVERRIDE_KEYS=$(printf '%s\n' "${OVERRIDES[@]}" | cut -d= -f1 | paste -sd'|' -)
grep -vE "^($OVERRIDE_KEYS)=" "$DOCKER_DIR/.env" > "$DOCKER_DIR/.env.merged" 2>/dev/null || true
printf '%s\n' "${OVERRIDES[@]}" >> "$DOCKER_DIR/.env.merged"

echo "==> Starting RAGFlow (docker compose)"
docker compose --env-file "$DOCKER_DIR/.env.merged" -f "$DOCKER_DIR/docker-compose.yml" up -d

echo "==> Configuring Caddy reverse proxy for $RAG_DOMAIN"
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$RAG_DOMAIN {
    # RAGFlow REST API (/api/v1) is served on host port 9380 (SVR_HTTP_PORT).
    reverse_proxy 127.0.0.1:9380
}
EOF
sudo systemctl reload caddy || sudo systemctl restart caddy

echo "==> Up. Check: curl -sk https://$RAG_DOMAIN/api/v1/system/config"
