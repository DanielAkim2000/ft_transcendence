#!/usr/bin/env bash
# Prepare les fichiers .env.dev et .env.prod a partir du modele.
# Les secrets (mot de passe base, JWT) sont generes aleatoirement ; les secrets OAuth 42 sont des placeholders a remplacer.
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

mkdir -p secrets

# Secrets générés aléatoirement s'ils n'existent pas (jamais commités : secrets/ est ignoré par git).
for name in postgres_password jwt_access_token_secret jwt_refresh_token_secret jwt_pre_auth_token_secret; do
  secret_path="secrets/${name}"
  if [ ! -f "$secret_path" ]; then
    openssl rand -hex 32 | tr -d '\n' > "$secret_path"
    echo "Created ${secret_path} (random value)."
  else
    echo "${secret_path} already exists, skipping."
  fi
done

# Secret de l'application OAuth 42 : à remplacer par le vrai secret (client_secret = prod, client_secret.dev = dev).
for name in client_secret client_secret.dev; do
  secret_path="secrets/${name}"
  if [ ! -f "$secret_path" ]; then
    printf 'change-me' > "$secret_path"
    echo "Created ${secret_path} (placeholder: put your 42 OAuth secret here to use 42 login)."
  else
    echo "${secret_path} already exists, skipping."
  fi
done

chmod 600 secrets/* 2>/dev/null || true
chmod 600 .env.dev .env.prod 2>/dev/null || true

echo ""
echo "Setup complete. Next steps:"
echo "  1. Edit .env.dev and .env.prod (CLIENT_ID, URLs, ports...)"
echo "  2. Put your 42 OAuth secret in secrets/client_secret (prod) and secrets/client_secret.dev (dev)"
echo "  3. Run: make prod (or make dev)"
