#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env.dev ] || [ ! -f secrets/postgres_password ]; then
  echo "Missing .env.dev or secrets. Run ./scripts/setup-docker.sh first."
  exit 1
fi

docker compose --env-file .env.prod -f docker-compose.yml down --remove-orphans >/dev/null 2>&1 || true
docker compose --env-file .env.dev -f docker-compose.dev.yml up --build "$@"
