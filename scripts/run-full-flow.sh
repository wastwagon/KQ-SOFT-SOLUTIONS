#!/bin/bash
# Run full BRS flow: seed DB, create project, upload & map documents.
# Requires: API running on port 9001, curl, DATABASE_URL set for seed.
# Usage: ./scripts/run-full-flow.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-http://localhost:9001}"
EMAIL="admin@qsoft.com"
PASSWORD="Test123!"
CASHBOOK="$ROOT/sample_data/cashbook_full.csv"
BANK="$ROOT/sample_data/bank_statement_full.csv"

echo "=== BRS Full Flow Script ==="
echo ""

# 1. Seed database
echo "1. Seeding database..."
(cd "$ROOT/api" && npx prisma db seed) || true
echo "   Done."
echo ""

# 2. Login
echo "2. Logging in..."
LOGIN=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "   ERROR: Login failed. Is the API running on $API_URL?"
  echo "   Response: $LOGIN"
  exit 1
fi
echo "   Logged in."
echo ""

# 3. Create project
echo "3. Creating project..."
PROJECT=$(curl -s -X POST "$API_URL/api/v1/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"BRS Demo '"$(date +%Y-%m-%d)"'","currency":"GHS"}')
PROJECT_ID=$(echo "$PROJECT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$PROJECT_ID" ]; then
  echo "   ERROR: Project creation failed."
  echo "   Response: $PROJECT"
  exit 1
fi
echo "   Project created: $PROJECT_ID"
echo ""

# 4. Upload cash book receipts
echo "4. Uploading cash book receipts..."
RECEIPTS=$(curl -s -X POST "$API_URL/api/v1/upload/cash-book/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$CASHBOOK" \
  -F "type=receipts")
RECEIPTS_DOC=$(echo "$RECEIPTS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "   Receipts doc: $RECEIPTS_DOC"
echo ""

# 5. Upload cash book payments
echo "5. Uploading cash book payments..."
PAYMENTS=$(curl -s -X POST "$API_URL/api/v1/upload/cash-book/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$CASHBOOK" \
  -F "type=payments")
PAYMENTS_DOC=$(echo "$PAYMENTS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "   Payments doc: $PAYMENTS_DOC"
echo ""

# 6. Upload bank credits
echo "6. Uploading bank statement credits..."
CREDITS=$(curl -s -X POST "$API_URL/api/v1/upload/bank-statement/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$BANK" \
  -F "type=credits" \
  -F "accountName=Main Account")
CREDITS_DOC=$(echo "$CREDITS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
BANK_ACCOUNT=$(echo "$CREDITS" | grep -o '"bankAccountId":"[^"]*"' | cut -d'"' -f4)
echo "   Credits doc: $CREDITS_DOC"
echo ""

# 7. Upload bank debits
echo "7. Uploading bank statement debits..."
DEBITS=$(curl -s -X POST "$API_URL/api/v1/upload/bank-statement/$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$BANK" \
  -F "type=debits" \
  -F "bankAccountId=$BANK_ACCOUNT")
DEBITS_DOC=$(echo "$DEBITS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "   Debits doc: $DEBITS_DOC"
echo ""

# Cash book mapping (indices for: s_no,date,name,details,doc_ref,chq_no,accode,amt_received,amt_paid)
CB_MAP='{"s_no":0,"date":1,"name":2,"details":3,"doc_ref":4,"chq_no":5,"accode":6,"amt_received":7,"amt_paid":8}'
# Bank mapping (transaction_date,description,credit,debit)
BANK_MAP='{"transaction_date":0,"description":1,"credit":2,"debit":3}'

# 8. Map receipts
echo "8. Mapping cash book receipts..."
curl -s -X POST "$API_URL/api/v1/documents/$RECEIPTS_DOC/map" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"mapping\":$CB_MAP}" > /dev/null
echo "   Done."
echo ""

# 9. Map payments
echo "9. Mapping cash book payments..."
curl -s -X POST "$API_URL/api/v1/documents/$PAYMENTS_DOC/map" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"mapping\":$CB_MAP}" > /dev/null
echo "   Done."
echo ""

# 10. Map credits
echo "10. Mapping bank credits..."
curl -s -X POST "$API_URL/api/v1/documents/$CREDITS_DOC/map" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"mapping\":$BANK_MAP}" > /dev/null
echo "   Done."
echo ""

# 11. Map debits
echo "11. Mapping bank debits..."
curl -s -X POST "$API_URL/api/v1/documents/$DEBITS_DOC/map" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"mapping\":$BANK_MAP}" > /dev/null
echo "   Done."
echo ""

echo "=== SUCCESS ==="
echo "Project ID: $PROJECT_ID"
echo "Web UI: http://localhost:9100/projects/$PROJECT_ID"
echo ""
echo "Next: Open the project in the UI, go to Reconcile to match transactions, then Review and Report."
