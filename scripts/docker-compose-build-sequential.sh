#!/usr/bin/env sh
# Build production images one service at a time to reduce peak RAM during `npm ci` / compile.
# Use on small VPS / Coolify hosts when `docker compose build` exits with code 255 and logs
# show no clear compiler error (often OOM when api + web build in parallel).
set -euf
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
docker compose build api "$@"
docker compose build web "$@"
