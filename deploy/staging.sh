#!/usr/bin/env bash
# Control the on-demand Runook staging host (run from your workstation; needs AWS CLI).
#
#   bash deploy/staging.sh up       # start it (reattaches EIP) — pay per hour while up
#   bash deploy/staging.sh down     # stop it — pay only for EBS + EIP
#   bash deploy/staging.sh status   # show state + endpoints
#
# Staging URLs: https://staging-rag.runook.com  |  https://staging-pay.runook.com
set -euo pipefail

ID="${STAGING_INSTANCE_ID:-i-0fd6812849ce90513}"
EIP="${STAGING_EIP_ALLOC:-eipalloc-0cb6ee80736c13913}"

case "${1:-status}" in
  up)
    aws ec2 start-instances --instance-ids "$ID" >/dev/null
    echo "starting $ID ..."
    aws ec2 wait instance-running --instance-ids "$ID"
    aws ec2 associate-address --instance-id "$ID" --allocation-id "$EIP" >/dev/null 2>&1 || true
    echo "UP. Services need ~1-2 min. https://staging-rag.runook.com"
    ;;
  down)
    aws ec2 stop-instances --instance-ids "$ID" >/dev/null
    echo "stopping $ID ..."
    aws ec2 wait instance-stopped --instance-ids "$ID"
    echo "STOPPED. Data + IP preserved; only EBS/EIP billed until next 'up'."
    ;;
  status)
    aws ec2 describe-instances --instance-ids "$ID" \
      --query "Reservations[].Instances[].{state:State.Name,type:InstanceType,ip:PublicIpAddress}" \
      --output table
    ;;
  *)
    echo "usage: bash deploy/staging.sh {up|down|status}"; exit 2;;
esac
