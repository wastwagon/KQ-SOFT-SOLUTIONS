#!/bin/sh
# Run Prisma migrations, then start the API.
#
# 1) P3009 (failed migration): optional auto resolve --rolled-back + retry (PRISMA_AUTO_RESOLVE_MIGRATIONS).
# 2) Empty DB: incremental migrations assume tables already exist; there is no baseline migration in git.
#    If Postgres reports relation "projects" does not exist, we db push from schema.prisma, clear
#    _prisma_migrations, mark all local migrations as applied, then migrate deploy (no-op).
#
# Disable bootstrap: PRISMA_BOOTSTRAP_EMPTY_DB=0
# Disable: PRISMA_AUTO_RESOLVE_MIGRATIONS="" (empty)
#
# (Named start-api.sh — not docker-entrypoint.sh — so logs are not confused with nginx's
# /docker-entrypoint.sh on the web container.)

set -eu
SCHEMA="./prisma/schema.prisma"

# Fail before migrations so Coolify "api" logs show this first (not only after Prisma runs).
if [ "${NODE_ENV:-}" = "production" ]; then
  if [ -z "${JWT_SECRET:-}" ] || [ "$JWT_SECRET" = "dev-secret" ]; then
    echo "start-api: FATAL — JWT_SECRET is missing, empty, or still \"dev-secret\"." >&2
    echo "start-api: In Coolify → this resource → Environment, set JWT_SECRET (32+ random characters), then redeploy." >&2
    exit 1
  fi
fi

run_migrate() {
  npx prisma migrate deploy --schema="$SCHEMA"
}

LOG=$(mktemp)
trap 'rm -f "$LOG"' EXIT

if run_migrate >"$LOG" 2>&1; then
  rm -f "$LOG"
  trap - EXIT
  echo "start-api: prisma migrate deploy OK — starting Node on port ${PORT:-9001}" >&2
  exec node dist/index.js
fi

cat "$LOG" >&2

# Fresh Docker volume: no tables yet; repo migrations start with ALTER on "projects".
if [ "${PRISMA_BOOTSTRAP_EMPTY_DB:-1}" != "0" ] && grep -q 'relation "projects" does not exist' "$LOG"; then
  echo "start-api: empty database (no projects table) — syncing schema with prisma db push, then marking migrations applied." >&2
  echo "start-api: disable this with PRISMA_BOOTSTRAP_EMPTY_DB=0 if you manage SQL by hand." >&2
  printf '%s\n' 'DELETE FROM "_prisma_migrations";' | npx prisma db execute --stdin --schema="$SCHEMA" >&2 || true
  npx prisma db push --schema="$SCHEMA" --skip-generate >&2
  for name in $(ls -1 prisma/migrations 2>/dev/null | LC_ALL=C sort); do
    case "$name" in 20*) ;;
    *) continue ;;
    esac
    [ -d "prisma/migrations/$name" ] || continue
    echo "start-api: migrate resolve --applied $name" >&2
    npx prisma migrate resolve --applied "$name" --schema="$SCHEMA" >&2
  done
  if run_migrate >"$LOG" 2>&1; then
    rm -f "$LOG"
    trap - EXIT
    echo "start-api: prisma migrate deploy OK (after bootstrap) — starting Node on port ${PORT:-9001}" >&2
    exec node dist/index.js
  fi
  cat "$LOG" >&2
  echo "start-api: migrate deploy failed after bootstrap" >&2
  exit 1
fi

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
      echo "start-api: P3009 mentions $m — prisma migrate resolve --rolled-back" >&2
      npx prisma migrate resolve --rolled-back "$m" --schema="$SCHEMA" >&2
      resolved_any=1
    fi
  done
  IFS=$OLDIFS

  if [ "$resolved_any" -eq 1 ]; then
    if run_migrate >"$LOG" 2>&1; then
      rm -f "$LOG"
      trap - EXIT
      echo "start-api: prisma migrate deploy OK (after resolve) — starting Node on port ${PORT:-9001}" >&2
      exec node dist/index.js
    fi
    cat "$LOG" >&2
    echo "start-api: migrate deploy still failing after auto-resolve" >&2
  fi
fi

exit 1
