#!/usr/bin/env bash
# Install the Runook host watchdog as a systemd timer (runs every 2 minutes).
# Idempotent. Run on the EC2 host (root/sudo, via SSM).
#
# The AWS-side alarms (SNS + CloudWatch + Route53 health checks) are created
# from the operator's workstation with the AWS CLI; this script only installs
# the on-host self-heal loop.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

sudo tee /etc/systemd/system/runook-watchdog.service >/dev/null <<UNIT
[Unit]
Description=Runook RAG watchdog (health check + self-heal)
After=docker.service

[Service]
Type=oneshot
Environment=RUNOOK_ROOT=$ROOT
ExecStart=/usr/bin/env bash $HERE/watchdog.sh
UNIT

sudo tee /etc/systemd/system/runook-watchdog.timer >/dev/null <<UNIT
[Unit]
Description=Run Runook watchdog every 2 minutes

[Timer]
OnBootSec=120
OnUnitActiveSec=120
AccuracySec=15s

[Install]
WantedBy=timers.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now runook-watchdog.timer
echo "==> watchdog timer installed:"
sudo systemctl list-timers runook-watchdog.timer --no-pager | head -4 || true
