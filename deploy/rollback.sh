#!/usr/bin/env bash
# Fast rollback for the Runook RAG engine.
#
# Re-points the running stack at a previously built SHA-tagged image WITHOUT
# rebuilding (seconds, not minutes). Images are produced by release.sh.
#
#   bash deploy/rollback.sh            # list available versions + current + history
#   bash deploy/rollback.sh <tag>      # roll back to runook-rag:<tag>
#   bash deploy/rollback.sh --prev     # roll back to the release before the current one
#
# Run on the EC2 host (root/sudo, via SSM).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
HIST="$HERE/.release-history"
DOCKER_DIR="$ROOT/ragflow/docker"

list() {
  local cur
  cur="$(docker images -q runook-rag:local 2>/dev/null || true)"
  echo "Available runook-rag versions:"
  docker images runook-rag --format '  {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}\t{{.ID}}' | grep -v $'^  local\t' || true
  echo
  echo "Currently deployed runook-rag:local -> image id ${cur:-none}"
  echo
  echo "Recent releases (newest last):"
  tail -8 "$HIST" 2>/dev/null || echo "  (no release history yet)"
}

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  list
  exit 0
fi

# --prev: pick the second-to-last *release* (ignore prior ROLLBACK lines).
if [[ "$TARGET" == "--prev" ]]; then
  TARGET="$(awk '$2 !~ /^ROLLBACK/ {print $2}' "$HIST" 2>/dev/null | tail -2 | head -1 || true)"
  [[ -z "$TARGET" ]] && { echo "No previous release found in $HIST"; exit 1; }
  echo "==> --prev resolves to: $TARGET"
fi

IMAGE="runook-rag:${TARGET}"
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "ERROR: image $IMAGE not found."
  echo
  list
  exit 1
fi

echo "==> Rolling back: promoting $IMAGE -> runook-rag:local"
docker tag "$IMAGE" runook-rag:local

echo "==> Recreating engine (no rebuild)"
docker compose -f "$DOCKER_DIR/docker-compose.yml" up -d --force-recreate

printf '%s  %-16s  %s\n' "$(date -u +%FT%TZ)" "ROLLBACK" "-> $TARGET" >> "$HIST"
echo "==> Rolled back to $IMAGE"
