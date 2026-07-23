#!/usr/bin/env bash
# Verify that a freshly loaded target database is a faithful copy of the source.
#
# Used by the shared-db migration (docs/runbooks/shared-db-migration.md): after
# `pg_dump` from the dedicated prod DB is `pg_restore`d into
# `rds/shared/loppemarked_prod`, run this to prove parity before the
# `db_secret_id` flip (#221). It compares, between SOURCE and TARGET:
#
#   1. Schema  — the set of user tables in `public`.
#   2. Row counts — per table.
#   3. Migration tracking — the rows in `kysely_migration`, so the app's
#      `migrateToLatestInline` is a no-op on first boot.
#   4. Sample app reads — `system_settings.opening_datetime` and the admin list.
#
# Any mismatch prints a diff and exits non-zero, so the runbook step can gate on
# `$?`.
#
# Connections are passed as libpq connection strings so the same script works
# against local scratch DBs, SSM port-forwarded RDS, or a bastion psql.
#
# Usage:
#   ./scripts/db-migrate-parity.sh \
#     "host=127.0.0.1 port=15432 dbname=loppemarked user=loppemarked sslmode=require" \
#     "host=127.0.0.1 port=15433 dbname=loppemarked_prod user=loppemarked sslmode=require"
#
# Passwords never come from the command line, so they don't land in shell
# history or process lists. The source and target are different RDS instances
# with different passwords, so a single PGPASSWORD cannot authenticate both.
# Provide them one of two ways:
#
#   - PGPASSWORD_SOURCE / PGPASSWORD_TARGET env vars (used per side), or
#   - a ~/.pgpass file with an entry per forwarded port, e.g.
#       127.0.0.1:15432:*:<source-user>:<source-password>
#       127.0.0.1:15433:*:<target-user>:<target-password>
#     (chmod 600 ~/.pgpass) — leave both env vars unset to use it.
#
# A plain PGPASSWORD (same on both sides) still works for the local-scratch case
# where source and target share credentials.
#
# This comparison is intentionally structural: it checks the table set, per-table
# row counts, migration history, and two sampled fields — not full row contents.
# That is the right gate for a fresh restore of a single dump (the only way counts
# and migration history match is a faithful load); it is not a byte-for-byte
# content audit.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <source-conninfo> <target-conninfo>" >&2
  echo "  each argument is a libpq connection string (see script header)" >&2
  exit 2
fi

SOURCE="$1"
TARGET="$2"

# Per-side passwords; fall back to a plain PGPASSWORD, then to ~/.pgpass.
SRC_PW="${PGPASSWORD_SOURCE:-${PGPASSWORD:-}}"
TGT_PW="${PGPASSWORD_TARGET:-${PGPASSWORD:-}}"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

fail=0

# Run a query against one side, returning tab-separated rows with no
# header/formatting noise so the two sides diff cleanly. The password is set
# only when non-empty, so an unset value falls through to ~/.pgpass instead of
# forcing an empty password.
q() {
  local conninfo="$1"
  local pw="$2"
  local sql="$3"
  if [[ -n "$pw" ]]; then
    PGPASSWORD="$pw" psql "$conninfo" --no-psqlrc --tuples-only --no-align \
      --field-separator=$'\t' --set ON_ERROR_STOP=1 --command "$sql"
  else
    psql "$conninfo" --no-psqlrc --tuples-only --no-align \
      --field-separator=$'\t' --set ON_ERROR_STOP=1 --command "$sql"
  fi
}

# All tables in the public schema. kysely_migration_lock is included: it's a
# single fixed bookkeeping row that matches on both sides, and comparing it
# costs nothing.
TABLES_SQL="
  SELECT tablename
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
"

echo "==> [1/4] schema: comparing the public table set"
q "$SOURCE" "$SRC_PW" "$TABLES_SQL" >"$WORKDIR/src_tables"
q "$TARGET" "$TGT_PW" "$TABLES_SQL" >"$WORKDIR/tgt_tables"
if diff -u "$WORKDIR/src_tables" "$WORKDIR/tgt_tables" >"$WORKDIR/tables.diff"; then
  echo "    OK — $(wc -l <"$WORKDIR/src_tables" | tr -d ' ') tables match"
else
  echo "    MISMATCH — table set differs (- source / + target):"
  sed 's/^/      /' "$WORKDIR/tables.diff"
  fail=1
fi

echo "==> [2/4] row counts: comparing per-table counts"
# Build a UNION ALL count query from a side's OWN table list, so neither side
# ever references a relation it lacks (a table present on only one side simply
# shows up as an added/removed line in the diff, rather than aborting psql).
count_sql() {
  local tables_file="$1"
  local first=1
  while IFS= read -r t; do
    [[ -z "$t" ]] && continue
    if [[ $first -eq 1 ]]; then first=0; else printf ' UNION ALL '; fi
    # Double-quote the table name as a SQL identifier (embedded quotes doubled).
    printf 'SELECT %s AS t, count(*) AS n FROM "%s"' "$(printf "'%s'" "${t//\'/\'\'}")" "${t//\"/\"\"}"
  done <"$tables_file"
  # An empty table list yields no query; emit a harmless no-op so psql succeeds
  # with zero rows instead of erroring on empty input.
  if [[ $first -eq 1 ]]; then
    printf 'SELECT NULL AS t, NULL AS n WHERE false'
  fi
}
run_counts() {
  local conninfo="$1" pw="$2" tables_file="$3" out="$4"
  local query
  query="$(count_sql "$tables_file")"
  q "$conninfo" "$pw" "$query ORDER BY t" >"$out"
}
run_counts "$SOURCE" "$SRC_PW" "$WORKDIR/src_tables" "$WORKDIR/src_counts"
run_counts "$TARGET" "$TGT_PW" "$WORKDIR/tgt_tables" "$WORKDIR/tgt_counts"
if diff -u "$WORKDIR/src_counts" "$WORKDIR/tgt_counts" >"$WORKDIR/counts.diff"; then
  echo "    OK — row counts match across all tables:"
  sed 's/^/      /' "$WORKDIR/src_counts"
else
  echo "    MISMATCH — row counts differ (- source / + target):"
  sed 's/^/      /' "$WORKDIR/counts.diff"
  fail=1
fi

echo "==> [3/4] migration tracking: comparing kysely_migration rows"
MIG_SQL="SELECT name FROM kysely_migration ORDER BY name;"
q "$SOURCE" "$SRC_PW" "$MIG_SQL" >"$WORKDIR/src_mig"
q "$TARGET" "$TGT_PW" "$MIG_SQL" >"$WORKDIR/tgt_mig"
if diff -u "$WORKDIR/src_mig" "$WORKDIR/tgt_mig" >"$WORKDIR/mig.diff"; then
  echo "    OK — $(wc -l <"$WORKDIR/src_mig" | tr -d ' ') applied migrations match:"
  sed 's/^/      /' "$WORKDIR/src_mig"
else
  echo "    MISMATCH — migration history differs (- source / + target):"
  sed 's/^/      /' "$WORKDIR/mig.diff"
  fail=1
fi

echo "==> [4/4] sample app reads: opening_datetime + admin emails"
SAMPLE_SQL="
  SELECT line FROM (
    SELECT 'opening_datetime='
         || coalesce(to_char(opening_datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), '<null>') AS line
    FROM system_settings
    UNION ALL
    SELECT 'admin=' || email FROM admins
  ) s
  ORDER BY line;
"
q "$SOURCE" "$SRC_PW" "$SAMPLE_SQL" >"$WORKDIR/src_sample"
q "$TARGET" "$TGT_PW" "$SAMPLE_SQL" >"$WORKDIR/tgt_sample"
if diff -u "$WORKDIR/src_sample" "$WORKDIR/tgt_sample" >"$WORKDIR/sample.diff"; then
  echo "    OK — sample reads match:"
  sed 's/^/      /' "$WORKDIR/src_sample"
else
  echo "    MISMATCH — sample reads differ (- source / + target):"
  sed 's/^/      /' "$WORKDIR/sample.diff"
  fail=1
fi

echo
if [[ $fail -eq 0 ]]; then
  echo "PARITY OK — target matches source. Safe to proceed with the db_secret_id flip."
  exit 0
else
  echo "PARITY FAILED — do NOT flip db_secret_id. Investigate the diffs above." >&2
  exit 1
fi
