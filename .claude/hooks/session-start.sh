#!/bin/bash
set -euo pipefail

# SessionStart hook for Claude Code on the web (remote sessions).
#
# Prepares the container so the full stack can run and Playwright can capture
# screenshots:
#   - installs npm workspace dependencies
#   - starts a local PostgreSQL 16 cluster on port 5433 (the project default)
#   - creates the loppemarked role/database and runs migrations + seed
#   - installs the Google Chrome channel used by the Playwright MCP server
#
# The dev servers themselves are started on demand (they are long-running):
#   DB_PASSWORD=localdev npm run dev --workspace=@loppemarked/api   # :3001
#   npm run dev --workspace=@loppemarked/web                        # :3000
#
# This hook is registered with the "remote" matcher, so it only runs in
# Claude Code on the web. It is idempotent and safe to run on every session.

REPO_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$REPO_DIR"

echo "[session-start] Installing npm dependencies..."
npm install

echo "[session-start] Ensuring PostgreSQL 16 cluster listens on port 5433..."
pg_conftool 16 main set port 5433
if ! pg_lsclusters | awk '$1=="16" && $2=="main" {print $4}' | grep -q online; then
  pg_ctlcluster 16 main start
fi

echo "[session-start] Waiting for PostgreSQL to accept connections..."
for _ in $(seq 1 30); do
  if pg_isready -h localhost -p 5433 -q; then
    break
  fi
  sleep 1
done

echo "[session-start] Ensuring loppemarked role and database exist..."
if ! su postgres -c "psql -p 5433 -tAc \"SELECT 1 FROM pg_roles WHERE rolname='loppemarked'\"" | grep -q 1; then
  su postgres -c "psql -p 5433 -c \"CREATE ROLE loppemarked LOGIN PASSWORD 'localdev'\""
fi
if ! su postgres -c "psql -p 5433 -tAc \"SELECT 1 FROM pg_database WHERE datname='loppemarked'\"" | grep -q 1; then
  su postgres -c "createdb -p 5433 -O loppemarked loppemarked"
fi

echo "[session-start] Running database migrations and seed..."
DB_PASSWORD=localdev npm run db:setup --workspace=@loppemarked/api

echo "[session-start] Installing Playwright Chrome browser..."
npx --yes playwright install --with-deps chrome

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "[session-start] Persisting DB_PASSWORD to the session environment..."
  echo 'export DB_PASSWORD=localdev' >> "$CLAUDE_ENV_FILE"
fi

echo "[session-start] Environment ready."
