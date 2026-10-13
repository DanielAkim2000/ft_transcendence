#!/bin/sh
# Restauration manuelle d'un dump Postgres.
# Sans argument : dernier dump ; avec un nom : dump demande.
# Pour la dev : COMPOSE_FILE=docker-compose.dev.yml ./scripts/db-restore.sh
# Le script demande confirmation, stoppe le backend puis le relance.
set -eu
cd "$(dirname "$0")/.."
COMPOSE="docker compose${COMPOSE_FILE:+ -f $COMPOSE_FILE}"

echo "Sauvegardes disponibles :"
$COMPOSE exec -T backup /db-backup.sh list

if [ -n "${1:-}" ]; then
  printf "Restaurer %s ? Les données actuelles seront REMPLACÉES. [y/N] " "$1"
else
  printf "Restaurer la sauvegarde la plus récente ? Les données actuelles seront REMPLACÉES. [y/N] "
fi
read -r answer
[ "$answer" = "y" ] || { echo "Annulé."; exit 1; }

$COMPOSE stop backend
$COMPOSE exec -T backup /db-backup.sh restore ${1:+"$1"}
$COMPOSE start backend
echo "Base restaurée."
