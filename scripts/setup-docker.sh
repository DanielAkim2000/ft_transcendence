#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — edit it with your values."
else
  echo ".env already exists, skipping."
fi

for example in secrets/*.example; do
  secret_name="$(basename "$example" .example)"
  secret_path="secrets/${secret_name}"

  if [ ! -f "$secret_path" ]; then
    cp "$example" "$secret_path"
    echo "Created ${secret_path} from example."
  else
    echo "${secret_path} already exists, skipping."
  fi
done

chmod 600 secrets/* 2>/dev/null || true
chmod 600 .env 2>/dev/null || true

echo ""
echo "Setup complete. Next steps:"
echo "  1. Edit .env (CLIENT_ID, URLs, ports...)"
echo "  2. Edit secrets/* with strong values (especially JWT secrets)"
echo "  3. Run: docker compose up --build"
