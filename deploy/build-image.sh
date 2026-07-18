#!/usr/bin/env bash
# One-click: apply Runook branding and build the runook-rag Docker image.
#
# Usage:
#   bash deploy/build-image.sh [TAG]
# Env:
#   RAGFLOW_IMAGE   base official image (default infiniflow/ragflow:v0.26.4)
#   PUSH=1          also push to $IMAGE_REPO (requires docker login)
#   IMAGE_REPO      registry repo, e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/runook-rag
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$HERE/.."
RAGFLOW_DIR="$ROOT/ragflow"
TAG="${1:-local}"
RAGFLOW_IMAGE="${RAGFLOW_IMAGE:-infiniflow/ragflow:v0.26.4}"
IMAGE_NAME="runook-rag:${TAG}"

if [[ ! -d "$RAGFLOW_DIR/web" ]]; then
  echo "==> RAGFlow source missing; cloning"
  git clone https://github.com/infiniflow/ragflow.git "$RAGFLOW_DIR"
fi

echo "==> Resetting web to pristine upstream before re-applying branding"
git -C "$RAGFLOW_DIR" config --global --add safe.directory "$RAGFLOW_DIR" 2>/dev/null || true
git -C "$RAGFLOW_DIR" checkout -- web 2>/dev/null || true

echo "==> Applying Runook branding overlay"
bash "$ROOT/branding/apply-branding.sh" "$RAGFLOW_DIR"

echo "==> Building $IMAGE_NAME (base: $RAGFLOW_IMAGE)"
docker build \
  -f "$HERE/Dockerfile.runook" \
  --build-arg RAGFLOW_IMAGE="$RAGFLOW_IMAGE" \
  -t "$IMAGE_NAME" \
  "$RAGFLOW_DIR"

echo "==> Built $IMAGE_NAME"

if [[ "${PUSH:-0}" == "1" ]]; then
  : "${IMAGE_REPO:?set IMAGE_REPO to push}"
  docker tag "$IMAGE_NAME" "$IMAGE_REPO:${TAG}"
  docker push "$IMAGE_REPO:${TAG}"
  echo "==> Pushed $IMAGE_REPO:${TAG}"
fi
