#!/usr/bin/env bash
# Install gVisor (runsc) and register it as a Docker runtime so RAGFlow's
# sandbox executor can launch isolated containers for Agent code execution.
#
# One-time host setup. Restarts the Docker daemon (brief downtime for all
# containers; compose restart policies bring them back).
set -euo pipefail

if ! command -v runsc >/dev/null 2>&1; then
  echo "==> Installing gVisor (runsc)"
  ARCH="$(uname -m)"
  URL="https://storage.googleapis.com/gvisor/releases/release/latest/${ARCH}"
  sudo curl -fsSL -o /usr/local/bin/runsc "${URL}/runsc"
  sudo curl -fsSL -o /usr/local/bin/containerd-shim-runsc-v1 "${URL}/containerd-shim-runsc-v1"
  sudo chmod 755 /usr/local/bin/runsc /usr/local/bin/containerd-shim-runsc-v1
else
  echo "==> runsc already installed"
fi

echo "==> Registering runsc as a Docker runtime"
# `runsc install` writes the runtime into /etc/docker/daemon.json.
# Use the systrap platform (works inside cloud VMs without nested virt).
sudo runsc install -- --platform=systrap || sudo runsc install || true

echo "==> Restarting Docker to load the runtime"
sudo systemctl restart docker

echo "==> Runtimes now available:"
docker info 2>/dev/null | grep -iA2 "Runtimes:" || true
