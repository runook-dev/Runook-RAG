#!/usr/bin/env bash
# Runook host watchdog: verify the engine + billing + Caddy are healthy and
# self-heal (restart) if not. Runs on a short systemd timer (see
# setup-monitoring.sh). Complements the external CloudWatch/Route53 alarms
# (which *notify*) by auto-recovering crashed containers/services.
#
# Only logs when it actually heals something; writes a heartbeat every run.
set -uo pipefail

ROOT="${RUNOOK_ROOT:-/home/ubuntu/Runook-RAG}"
COMPOSE="$ROOT/ragflow/docker/docker-compose.yml"
LOG="/var/log/runook-watchdog.log"
BEAT="/run/runook-watchdog.beat"

log() { echo "$(date -u +%FT%TZ) $*" >> "$LOG" 2>/dev/null || true; }

healed=0

# 1) Engine web/API on :8080 (Caddy proxies this to customers).
if ! curl -fsS -m 8 -o /dev/null http://127.0.0.1:8080/; then
  log "engine :8080 unhealthy -> docker compose up -d"
  docker compose -f "$COMPOSE" up -d >/dev/null 2>&1 || true
  healed=1
fi

# 2) Core data containers must be running.
for c in docker-ragflow-cpu-1 docker-mysql-1 docker-es01-1 docker-redis-1 docker-minio-1; do
  st=$(docker inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo missing)
  if [ "$st" != "running" ]; then
    log "container $c is '$st' -> docker compose up -d"
    docker compose -f "$COMPOSE" up -d >/dev/null 2>&1 || true
    healed=1
  fi
done

# 3) Billing service on :3100.
if ! curl -fsS -m 8 -o /dev/null http://127.0.0.1:3100/; then
  log "billing :3100 unhealthy -> systemctl restart runook-billing"
  systemctl restart runook-billing >/dev/null 2>&1 || true
  healed=1
fi

# 4) Caddy (HTTPS front door).
if ! systemctl is-active --quiet caddy; then
  log "caddy inactive -> systemctl restart caddy"
  systemctl restart caddy >/dev/null 2>&1 || true
  healed=1
fi

echo "$(date -u +%FT%TZ) healed=$healed" > "$BEAT" 2>/dev/null || true
[ "$healed" = 1 ] && log "self-heal run complete (healed=1)"
exit 0
