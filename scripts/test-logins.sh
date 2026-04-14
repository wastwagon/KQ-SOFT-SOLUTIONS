#!/usr/bin/env bash
# Test all seed logins and dashboard access. Requires: API running (port 9001), DB running.
# Usage: ./scripts/test-logins.sh [API_URL]
# Password for all: Test123!

set -e
API_URL="${1:-http://localhost:9001}"
PASS="Test123!"

accounts=(
  "admin@qsoft.com|Q-SOFT Admin|firm"
  "basic@test.com|Test Basic Org|basic"
  "standard@test.com|Test Standard Org|standard"
  "premium@test.com|Test Premium Org|premium"
  "firm@test.com|Test Firm Org|firm"
)

echo "Testing logins against $API_URL"
echo "---"

pass_count=0
fail_count=0

for entry in "${accounts[@]}"; do
  IFS='|' read -r email expected_org plan <<< "$entry"
  echo -n "Login $email (plan: $plan) ... "

  resp=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASS\"}")

  http_code=$(echo "$resp" | tail -n1)
  body=$(echo "$resp" | sed '$d')

  if [[ "$http_code" != "200" ]]; then
    echo "FAIL (HTTP $http_code) $body"
    ((fail_count++)) || true
    continue
  fi

  token=$(echo "$body" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  if [[ -z "$token" ]]; then
    echo "FAIL (no token in response)"
    ((fail_count++)) || true
    continue
  fi

  # Verify dashboard/API access with token
  dash_code=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/v1/subscription/usage" \
    -H "Authorization: Bearer $token")

  if [[ "$dash_code" != "200" ]]; then
    echo "FAIL (dashboard HTTP $dash_code)"
    ((fail_count++)) || true
    continue
  fi

  org_name=$(echo "$body" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "OK -> org: $org_name (redirect/dashboard accessible)"
  ((pass_count++)) || true
done

echo "---"
echo "Pass: $pass_count  Fail: $fail_count"
if [[ $fail_count -gt 0 ]]; then
  exit 1
fi
