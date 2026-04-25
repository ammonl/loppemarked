#!/usr/bin/env bash
# Open an SSM port forward from your laptop to the staging (or prod) RDS
# instance. Run this in one terminal and leave it open; in a second terminal,
# run `psql` against the printed connection string.
#
# Requires:
#   - aws CLI v2 with the session-manager-plugin installed
#   - jq
#   - AWS credentials with access to the SSM bastion + Secrets Manager
#   - A bastion EC2 with the SSM agent role, in a subnet whose SG can reach RDS
#
# Usage:
#   ./scripts/db-port-forward.sh -i i-0123456789abcdef0
#   ./scripts/db-port-forward.sh -i i-... -e prod -r eu-north-1 -p 15432

set -euo pipefail

ENV="staging"
REGION="${AWS_REGION:-eu-north-1}"
LOCAL_PORT=15432
INSTANCE_ID=""

usage() {
  cat <<EOF
Usage: $0 -i <bastion-instance-id> [-e <env>] [-r <region>] [-p <local-port>]

  -i  EC2 instance id of the SSM bastion (required)
  -e  environment (staging | prod) [default: staging]
  -r  AWS region [default: \$AWS_REGION or eu-north-1]
  -p  local port to bind [default: 15432]
EOF
  exit 1
}

while getopts ":i:e:r:p:h" opt; do
  case "$opt" in
    i) INSTANCE_ID="$OPTARG" ;;
    e) ENV="$OPTARG" ;;
    r) REGION="$OPTARG" ;;
    p) LOCAL_PORT="$OPTARG" ;;
    h|*) usage ;;
  esac
done

if [[ -z "$INSTANCE_ID" ]]; then
  echo "error: bastion instance id (-i) is required" >&2
  usage
fi

if [[ "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  echo "error: env must be 'staging' or 'prod' (got '$ENV')" >&2
  exit 1
fi

for cmd in aws jq session-manager-plugin; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: '$cmd' not found on PATH" >&2
    exit 1
  fi
done

SECRET_NAME="loppemarked-${ENV}-2026-db-credentials"

echo "[info] resolving secret arn for ${SECRET_NAME} in ${REGION}…"
SECRET_ARN=$(
  aws secretsmanager list-secrets \
    --region "$REGION" \
    --filters "Key=name,Values=${SECRET_NAME}" \
    --query 'SecretList[0].ARN' \
    --output text
)
if [[ -z "$SECRET_ARN" || "$SECRET_ARN" == "None" ]]; then
  echo "error: could not find secret '${SECRET_NAME}' in region ${REGION}" >&2
  exit 1
fi

echo "[info] fetching DB credentials…"
SECRET_JSON=$(
  aws secretsmanager get-secret-value \
    --region "$REGION" \
    --secret-id "$SECRET_ARN" \
    --query SecretString \
    --output text
)

DB_HOST=$(jq -r '.host'     <<<"$SECRET_JSON")
DB_PORT=$(jq -r '.port'     <<<"$SECRET_JSON")
DB_USER=$(jq -r '.username' <<<"$SECRET_JSON")
DB_NAME=$(jq -r '.dbname'   <<<"$SECRET_JSON")
DB_PASS=$(jq -r '.password' <<<"$SECRET_JSON")

cat <<EOF

[info] connection details for env=${ENV} (do NOT paste the password publicly):

  host=127.0.0.1 port=${LOCAL_PORT} dbname=${DB_NAME} user=${DB_USER} sslmode=require

  In a second terminal, run:

    PGPASSWORD='${DB_PASS}' psql "host=127.0.0.1 port=${LOCAL_PORT} dbname=${DB_NAME} user=${DB_USER} sslmode=require"

  Press Ctrl+C in this window to close the tunnel.

EOF

exec aws ssm start-session \
  --region "$REGION" \
  --target "$INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "host=${DB_HOST},portNumber=${DB_PORT},localPortNumber=${LOCAL_PORT}"
