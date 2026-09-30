#!/bin/sh
# Restaure la base depuis une sauvegarde (procédure de reprise après sinistre).
#   ./scripts/db-restore.sh [fichier.sql.gz]   (le plus récent par défaut)
#   COMPOSE_FILE=docker-compose.dev.yml ./scripts/db-restore.sh
# Arrête le backend, restaure, puis le relance (il rejoue les migrations au démarrage).
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
