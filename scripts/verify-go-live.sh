#!/usr/bin/env bash
# Unified go-live verification for matching + project identity + parsers.
# Run from repo root:
#   ./scripts/verify-go-live.sh
#   ./scripts/verify-go-live.sh --with-live-api
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/api"
WEB="$ROOT/web"
WITH_LIVE_API=0
for arg in "$@"; do
  case "$arg" in
    --with-live-api) WITH_LIVE_API=1 ;;
  esac
done

pass=0
fail=0
step() { echo ""; echo "▸ $*"; }
ok() { echo "  ✓ $*"; pass=$((pass + 1)); }
bad() { echo "  ✗ $*"; fail=$((fail + 1)); }

step "1/5 Infra (Postgres)"
if nc -z -w 3 localhost 15441 2>/dev/null; then
  ok "Postgres reachable on localhost:15441"
else
  bad "Postgres not reachable on localhost:15441 — start kqsoftsolutions-postgres-1"
fi

step "2/5 Matching + regional + identity unit tests (API)"
cd "$API"
if npx vitest run \
  src/services/matching.test.ts \
  src/services/bankRules.test.ts \
  src/services/scbSweepMatcher.test.ts \
  src/services/ecobankClearingMatcher.test.ts \
  src/services/ghanaRegionalMatchers.test.ts \
  src/lib/projectIdentity.test.ts \
  src/services/countMatchDiagnostic.test.ts \
  src/services/gcbStatement.test.ts \
  src/services/nibStatement.test.ts \
  src/services/prudentialStatement.test.ts \
  src/services/absaStatement.test.ts \
  src/services/bankOfAfricaStatement.test.ts \
  src/services/scbStatement.test.ts; then
  ok "API go-live unit packs passed"
else
  bad "API go-live unit packs failed"
fi

step "3/5 Phase B / profile tip unit tests (Web)"
cd "$WEB"
if npx vitest run src/lib/phasedAutoMatch.test.ts src/lib/ghanaBankProfileTips.test.ts; then
  ok "Web go-live unit packs passed"
else
  bad "Web go-live unit packs failed"
fi

step "4/5 DB unification smoke (project identity + report entity)"
cd "$API"
if npx tsx scripts/verify-go-live.ts; then
  ok "DB unification smoke passed"
else
  bad "DB unification smoke failed"
fi

step "5/5 Live API (optional)"
if [[ "$WITH_LIVE_API" -eq 1 ]]; then
  code=$(curl -sS -o /tmp/brs-health.json -w '%{http_code}' http://localhost:9101/healthz || echo 000)
  if [[ "$code" == "200" ]]; then
    ok "API /healthz → 200"
    # Auth-gated create smoke only if SMOKE_TOKEN or demo creds provided
    if [[ -n "${SMOKE_EMAIL:-}" && -n "${SMOKE_PASSWORD:-}" ]]; then
      login=$(curl -sS -X POST http://localhost:9101/api/v1/auth/login \
        -H 'Content-Type: application/json' \
        -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}" || true)
      token=$(node -e "try{const j=JSON.parse(process.argv[1]);process.stdout.write(j.token||j.accessToken||'')}catch{}" "$login")
      if [[ -n "$token" ]]; then
        stamp=$(date +%s)
        create=$(curl -sS -X POST http://localhost:9101/api/v1/projects \
          -H "Authorization: Bearer $token" \
          -H 'Content-Type: application/json' \
          -d "{\"statementBusinessName\":\"LIVE VERIFY $stamp\",\"primaryAccountName\":\"Current\",\"primaryBankName\":\"Ecobank\",\"primaryAccountNo\":\"1441001234567\",\"reconciliationDate\":\"2023-09-30T00:00:00.000Z\"}")
        has=$(node -e "const j=JSON.parse(process.argv[1]);process.stdout.write(j.statementBusinessName&&j.slug?'yes':'no')" "$create")
        if [[ "$has" == "yes" ]]; then
          ok "Live project create with statementBusinessName"
          slug=$(node -e "process.stdout.write(JSON.parse(process.argv[1]).slug)" "$create")
          report=$(curl -sS "http://localhost:9101/api/v1/report/$slug" -H "Authorization: Bearer $token" || true)
          entity=$(node -e "try{const j=JSON.parse(process.argv[1]);process.stdout.write(j.reportEntityName||'')}catch{}" "$report")
          if [[ "$entity" == "LIVE VERIFY $stamp" ]]; then
            ok "Live reportEntityName matches statement business name"
          else
            bad "Live reportEntityName unexpected: ${entity:-empty}"
          fi
        else
          bad "Live project create failed: ${create:0:200}"
        fi
      else
        bad "Login failed for SMOKE_EMAIL (skipping authenticated checks)"
      fi
    else
      ok "Skipped authenticated live create (set SMOKE_EMAIL + SMOKE_PASSWORD to enable)"
    fi
  else
    bad "API /healthz → $code (is kqsoftsolutions-api-1 healthy?)"
  fi
else
  ok "Skipped live API (pass --with-live-api to enable)"
fi

echo ""
echo "=============================="
echo "Go-live verification: $pass passed, $fail failed"
echo "=============================="
[[ "$fail" -eq 0 ]]
