#!/bin/bash
# Same as run-full-flow.sh but uses new-test-data Qtest workbooks (LICL workbook reference).
# Regression figures for the template are locked in: new-test-data/qtest-licl-golden.json
# Run from repo root: npm run demo:flow:qtest
# API: cd api && npm run test:licl-qtest

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-http://localhost:9001}"
EMAIL="${DEMO_EMAIL:-admin@kqsoftwaresolutions.com}"
PASSWORD="${DEMO_PASSWORD:-Test123!}"
CASHBOOK="$ROOT/new-test-data/Qtestcash book.xlsx"
BANK="$ROOT/new-test-data/Qtestbank statement.xlsx"

if [[ ! -f "$CASHBOOK" || ! -f "$BANK" ]]; then
  echo "Missing Qtest files. Expected:"
  echo "  $CASHBOOK"
  echo "  $BANK"
  exit 1
fi

echo "=== BRS Qtest / LICL workbook flow ==="
echo "Using: Qtestcash book + Qtestbank statement (see new-test-data/qtest-licl-golden.json)."
echo ""

echo "1. Seeding database..."
(cd "$ROOT/api" && npx prisma db seed) || true
echo ""

echo "2. Logging in..."
LOGIN=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [[ -z "$TOKEN" ]]; then
  echo "   ERROR: Login failed. Is the API running on $API_URL?"
  exit 1
fi
echo "   Logged in."
echo ""

echo "3. Creating project..."
PROJECT=$(curl -s -X POST "$API_URL/api/v1/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Qtest LICL reference '"$(date +%Y-%m-%d)"'","currency":"GHS","reconciliationDate":"2023-01-31T00:00:00.000Z"}')
PROJECT_ID=$(echo "$PROJECT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [[ -z "$PROJECT_ID" ]]; then
  echo "   ERROR: Project creation failed."
  echo "   Response: $PROJECT"
  exit 1
fi
echo "   Project: $PROJECT_ID"
echo ""

echo "4–7. Upload cash book + bank statement..."
RECEIPTS=$(curl -s -X POST "$API_URL/api/v1/upload/cash-book/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$CASHBOOK" \
  -F "type=receipts")
RECEIPTS_DOC=$(echo "$RECEIPTS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

PAYMENTS=$(curl -s -X POST "$API_URL/api/v1/upload/cash-book/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$CASHBOOK" \
  -F "type=payments")
PAYMENTS_DOC=$(echo "$PAYMENTS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

CREDITS=$(curl -s -X POST "$API_URL/api/v1/upload/bank-statement/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$BANK" \
  -F "type=credits" \
  -F "accountName=Ecobank Main" \
  -F "accountNo=5565668889")
CREDITS_DOC=$(echo "$CREDITS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
BANK_ACCOUNT=$(echo "$CREDITS" | grep -o '"bankAccountId":"[^"]*"' | cut -d'"' -f4)

DEBITS=$(curl -s -X POST "$API_URL/api/v1/upload/bank-statement/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$BANK" \
  -F "type=debits" \
  -F "bankAccountId=$BANK_ACCOUNT")
DEBITS_DOC=$(echo "$DEBITS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "   Receipts doc: $RECEIPTS_DOC | Payments doc: $PAYMENTS_DOC"
echo "   Bank credits doc: $CREDITS_DOC | Bank debits doc: $DEBITS_DOC"
echo ""

CB_MAP='{"s_no":0,"date":1,"name":2,"details":3,"doc_ref":4,"chq_no":5,"accode":6,"amt_received":7,"amt_paid":8}'
BANK_MAP='{"transaction_date":0,"description":1,"credit":2,"debit":3}'

echo "8–11. Map columns..."
curl -s -X POST "$API_URL/api/v1/documents/$RECEIPTS_DOC/map" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"mapping\":$CB_MAP}" > /dev/null
curl -s -X POST "$API_URL/api/v1/documents/$PAYMENTS_DOC/map" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"mapping\":$CB_MAP}" > /dev/null
curl -s -X POST "$API_URL/api/v1/documents/$CREDITS_DOC/map" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"mapping\":$BANK_MAP}" > /dev/null
curl -s -X POST "$API_URL/api/v1/documents/$DEBITS_DOC/map" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"mapping\":$BANK_MAP}" > /dev/null

echo ""
echo "=== SUCCESS ==="
echo "Project ID: $PROJECT_ID"
echo "Golden figures vs source files:  cd api && npm run test:licl-qtest"
echo "Web UI (dev): open your projects list and reconcile to align with qtest-licl-golden.json (5,400 unpresented, etc.)."
echo ""
