#!/usr/bin/env bash
# Install & run the Runook RAG billing service on the EC2 host (systemd),
# and install the hourly quota-enforcement timer. Idempotent.
#
# Prereqs: billing/.env.local must exist (secrets), and Caddy must proxy
# pay.runook.com -> 127.0.0.1:3100 (handled by start-engine.sh).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
BILLING="$(cd "$ROOT/billing" && pwd)"
RAGFLOW_CONTAINER="${RAGFLOW_CONTAINER:-docker-ragflow-cpu-1}"

echo "==> Ensure the service user can run docker (for provisioning)"
sudo usermod -aG docker ubuntu || true

echo "==> Node.js 20"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Build billing service"
cd "$BILLING"
npm ci
npm run build

echo "==> Copy in-container tools"
docker cp "$ROOT/deploy/provision_tenant.py" "$RAGFLOW_CONTAINER:/ragflow/provision_tenant.py" || true
docker cp "$ROOT/deploy/quota_tool.py" "$RAGFLOW_CONTAINER:/ragflow/quota_tool.py" || true
docker cp "$ROOT/deploy/list_users.py" "$RAGFLOW_CONTAINER:/ragflow/list_users.py" || true

echo "==> systemd service (runook-billing)"
sudo tee /etc/systemd/system/runook-billing.service >/dev/null <<UNIT
[Unit]
Description=Runook RAG billing service
After=network.target docker.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$BILLING
Environment=NODE_ENV=production
Environment=PORT=3100
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable runook-billing
sudo systemctl restart runook-billing

echo "==> Hourly quota enforcement timer"
sudo tee /etc/systemd/system/runook-quota.service >/dev/null <<UNIT
[Unit]
Description=Runook RAG quota enforcement
[Service]
Type=oneshot
User=ubuntu
WorkingDirectory=$BILLING
EnvironmentFile=$BILLING/.env.local
ExecStart=/usr/bin/node scripts/reconcile-accounts.mjs
UNIT
sudo tee /etc/systemd/system/runook-quota.timer >/dev/null <<UNIT
[Unit]
Description=Run Runook RAG quota enforcement hourly
[Timer]
OnCalendar=hourly
Persistent=true
[Install]
WantedBy=timers.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now runook-quota.timer

echo "==> Done. Status:"
sudo systemctl --no-pager status runook-billing | head -5 || true
