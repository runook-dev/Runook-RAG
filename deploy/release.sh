#!/usr/bin/env bash
# Versioned release for the Runook RAG engine image.
#
# Builds a git-SHA-tagged image (runook-rag:<sha>), promotes it to the pointer
# tag the running stack uses (runook-rag:local), restarts the engine, records a
# rollback history, and prunes old versions. This is what makes fast rollback
# possible — see rollback.sh.
#
#   bash deploy/release.sh            # build + deploy current HEAD
#   KEEP=8 bash deploy/release.sh     # retain more old versions (default 5)
#
# Run on the EC2 host (root/sudo, via SSM). Assumes git pull already done.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
KEEP="${KEEP:-5}"                                  # SHA-tagged images to retain
HIST="$HERE/.release-history"                      # append-only log (gitignored)
BASE_IMAGE="${RAGFLOW_BASE_IMAGE:-infiniflow/ragflow:v0.26.4}"

cd "$ROOT"
SHA="$(git rev-parse --short HEAD)"
DIRTY=""; git diff --quiet 2>/dev/null || DIRTY="-dirty"
TAG="${SHA}${DIRTY}"
IMAGE="runook-rag:${TAG}"

echo "==> Releasing $IMAGE (base: $BASE_IMAGE)"
# Build the SHA-tagged image. Force the correct FROM base regardless of any
# ambient RAGFLOW_IMAGE (engine.env sets that to runook-rag:local for runtime).
RAGFLOW_IMAGE="$BASE_IMAGE" bash "$HERE/build-image.sh" "$TAG"

# Promote to the pointer tag the compose stack runs (${RAGFLOW_IMAGE}).
docker tag "$IMAGE" runook-rag:local
printf '%s  %-16s  %s\n' "$(date -u +%FT%TZ)" "$TAG" "$(git log -1 --pretty=%s)" >> "$HIST"

echo "==> Restarting engine on $IMAGE"
cd "$HERE" && bash start-engine.sh

echo "==> Pruning old SHA-tagged images (keeping newest $KEEP)"
docker images runook-rag --format '{{.CreatedAt}}|{{.Tag}}' \
  | grep -v '|local$' \
  | sort -r \
  | tail -n +"$((KEEP + 1))" \
  | cut -d'|' -f2 \
  | while read -r t; do [ -n "$t" ] && docker rmi "runook-rag:$t" >/dev/null 2>&1 || true; done

echo "==> Released $IMAGE -> promoted to runook-rag:local"
echo "==> Recent releases:"
tail -6 "$HIST" 2>/dev/null || true
