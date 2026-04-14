#!/bin/sh
# Run Prisma migrations, then start the API. If deploy fails with P3009 for a known
# historically-broken migration (wrong table names in SQL), mark it rolled back once
# and retry — avoids manual `migrate resolve` on Coolify after fixing migration files.
#
# Disable: PRISMA_AUTO_RESOLVE_MIGRATIONS="" (empty)
# Extend:  PRISMA_AUTO_RESOLVE_MIGRATIONS="name1,name2"

set -eu
SCHEMA="./prisma/schema.prisma"

run_migrate() {
  npx prisma migrate deploy --schema="$SCHEMA"
}

LOG=$(mktemp)
trap 'rm -f "$LOG"' EXIT

if run_migrate >"$LOG" 2>&1; then
  rm -f "$LOG"
  trap - EXIT
  exec node dist/index.js
fi

cat "$LOG" >&2

MIGS="${PRISMA_AUTO_RESOLVE_MIGRATIONS-20250228140000_add_project_slug}"

if [ -n "$MIGS" ] && grep -q "P3009" "$LOG"; then
  resolved_any=0
  OLDIFS=$IFS
  IFS=','
  for m in $MIGS; do
    IFS=$OLDIFS
    m=$(printf '%s' "$m" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -z "$m" ] && continue
    if grep -q "$m" "$LOG"; then
      echo "docker-entrypoint: P3009 mentions $m — prisma migrate resolve --rolled-back" >&2
      npx prisma migrate resolve --rolled-back "$m" --schema="$SCHEMA" >&2
      resolved_any=1
    fi
  done
  IFS=$OLDIFS

  if [ "$resolved_any" -eq 1 ]; then
    if run_migrate; then
      rm -f "$LOG"
      trap - EXIT
      exec node dist/index.js
    fi
    echo "docker-entrypoint: migrate deploy still failing after auto-resolve" >&2
  fi
fi

exit 1
