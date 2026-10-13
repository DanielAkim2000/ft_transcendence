#!/bin/sh
# Preparation du backend avant de lancer Node.
# On garde CI=true pour eviter les questions interactives de pnpm/Prisma.
set -e

export CI=true

# Compose fournit les secrets sous forme de fichiers dans /run/secrets.
load_secret() {
  var_name="$1"
  secret_file="$2"

  if [ -f "$secret_file" ]; then
    value=$(tr -d '\n' < "$secret_file")
    export "$var_name=$value"
  fi
}

load_secret POSTGRES_PASSWORD /run/secrets/postgres_password
load_secret JWT_ACCESS_TOKEN_SECRET /run/secrets/jwt_access_token_secret
load_secret JWT_REFRESH_TOKEN_SECRET /run/secrets/jwt_refresh_token_secret
load_secret JWT_PRE_AUTH_TOKEN_SECRET /run/secrets/jwt_pre_auth_token_secret
load_secret CLIENT_SECRET /run/secrets/client_secret

# La connexion est construite avec le nom du service Docker db.
if [ -z "$DATABASE_URL" ] && [ -n "$POSTGRES_PASSWORD" ]; then
  POSTGRES_USER="${POSTGRES_USER:-ft_user}"
  POSTGRES_DB="${POSTGRES_DB:-ft_transcendence}"
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public"
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set and postgres secret is missing." >&2
  exit 1
fi

# Mise a jour du client Prisma et des migrations avant le lancement.
echo "Generating Prisma client..."
pnpm exec prisma generate --no-hints

echo "Running database migrations..."
pnpm exec prisma migrate deploy

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "Seeding database..."
  pnpm exec prisma db seed || echo "WARNING: seed failed, starting backend anyway."
fi

echo "Starting backend..."
exec "$@"
