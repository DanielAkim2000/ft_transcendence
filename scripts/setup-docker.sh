#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

for env_file in .env.dev .env.prod; do
  if [ ! -f "$env_file" ]; then
    cp .env.example "$env_file"
    echo "Created $env_file from .env.example — edit it with your values."
  else
    echo "$env_file already exists, skipping."
  fi
done

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
chmod 600 .env.dev .env.prod 2>/dev/null || true

echo ""
echo "Setup complete. Next steps:"
echo "  1. Edit .env.dev and .env.prod (CLIENT_ID, URLs, ports...)"
echo "  2. Edit secrets/* with strong values (especially JWT secrets)"
echo "  3. Create secrets/client_secret (prod) and secrets/client_secret.dev (dev)
  4. Run: make dev (or make prod)"
