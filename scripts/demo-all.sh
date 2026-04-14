#!/bin/bash
# One-command demo: start DB (if Docker), seed, run API, create project with sample data.
# Usage: ./scripts/demo-all.sh
# Prereq: Docker Desktop running (for DB), or PostgreSQL on localhost:15432

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-http://localhost:9001}"

echo "=== BRS One-Command Demo ==="
echo ""

# Start PostgreSQL via Docker if needed
if command -v docker &>/dev/null; then
  if docker info &>/dev/null 2>&1; then
    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^brs-postgres$'; then
      echo "Starting PostgreSQL container..."
      docker run -d --name brs-postgres \
        -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=brs_db \
        -p 15432:5432 postgres:15 2>/dev/null || docker start brs-postgres 2>/dev/null || true
      sleep 3
    fi
  else
    echo "Docker is installed but not running. Please start Docker Desktop, then run this script again."
    exit 1
  fi
fi

# Migrate & seed
echo "Setting up database..."
(cd "$ROOT/api" && npx prisma db push --accept-data-loss 2>/dev/null) || true
(cd "$ROOT/api" && npx prisma db seed) || { echo "Seed failed - is PostgreSQL running on localhost:15432?"; exit 1; }
echo "   Done."
echo ""

# Kill anything on 9001
lsof -ti:9001 | xargs kill -9 2>/dev/null || true
sleep 2

# Start API in background
echo "Starting API..."
cd "$ROOT/api" && npm run dev &
API_PID=$!
sleep 6

# Run flow
echo ""
echo "Running demo flow..."
cd "$ROOT" && bash scripts/run-full-flow.sh

echo ""
echo "API is running in background (PID $API_PID). Stop with: kill $API_PID"
