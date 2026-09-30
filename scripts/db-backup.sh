#!/bin/sh
# Sauvegardes PostgreSQL, exécuté dans le conteneur "backup" (postgres:16-alpine).
#
#   db-backup.sh run                 boucle : un dump immédiat, puis un toutes les BACKUP_INTERVAL_HOURS
#   db-backup.sh once                un dump immédiat
#   db-backup.sh list                liste les dumps disponibles
#   db-backup.sh restore [fichier]   restaure un dump (le plus récent par défaut)
#
# Un dump est un .sql.gz horodaté dans BACKUP_DIR ; ceux de plus de
# BACKUP_RETENTION_DAYS jours sont supprimés (on garde toujours le plus récent).
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
PGHOST="${PGHOST:-db}"
PGUSER="${POSTGRES_USER:-ft_user}"
PGDATABASE="${POSTGRES_DB:-ft_transcendence}"
export PGHOST PGUSER PGDATABASE

if [ -z "${PGPASSWORD:-}" ] && [ -f /run/secrets/postgres_password ]; then
  PGPASSWORD="$(tr -d '\n' < /run/secrets/postgres_password)"
  export PGPASSWORD
fi

mkdir -p "$BACKUP_DIR"

log() { echo "[backup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

# Dump complet (--clean --if-exists : restaurable sur une base existante).
# On dump d'abord dans un fichier brut, puis on compresse : avec un simple
# « pg_dump | gzip », le code de retour serait celui de gzip et un dump raté
# (base injoignable) passerait pour réussi. Le fichier final n'apparaît (mv)
# qu'une fois le dump ET la compression terminés, et il ne doit pas être vide.
backup_once() {
  file="$BACKUP_DIR/${PGDATABASE}_$(date -u +%Y%m%d_%H%M%S).sql.gz"
  raw="$file.raw"
  if pg_dump --clean --if-exists --no-owner --no-privileges --file "$raw" \
     && [ -s "$raw" ] \
     && gzip -c "$raw" > "$file.tmp" \
     && [ -s "$file.tmp" ]; then
    rm -f "$raw"
    mv "$file.tmp" "$file"
    log "ok: $file ($(du -h "$file" | cut -f1))"
    prune
  else
    rm -f "$raw" "$file.tmp"
    log "ERREUR: le dump a échoué (base injoignable ?), aucune sauvegarde créée"
    return 1
  fi
}

# Supprime les dumps plus vieux que la rétention, sauf le plus récent.
prune() {
  latest="$(ls -1t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -n 1 || true)"
  find "$BACKUP_DIR" -name '*.sql.gz' -mtime "+$BACKUP_RETENTION_DAYS" | while read -r old; do
    [ "$old" = "$latest" ] || { rm -f "$old"; log "supprimé (rétention ${BACKUP_RETENTION_DAYS}j): $old"; }
  done
}

list_backups() { ls -1t "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "(aucune sauvegarde)"; }

# Restaure dans une seule transaction : en cas d'erreur, la base reste intacte.
# L'application doit être arrêtée (aucune connexion active) : voir scripts/db-restore.sh.
restore() {
  file="${1:-$(ls -1t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -n 1 || true)}"
  case "$file" in /*|"") ;; *) file="$BACKUP_DIR/$file" ;; esac
  [ -n "$file" ] && [ -f "$file" ] || { log "ERREUR: sauvegarde introuvable"; exit 1; }
  log "restauration de $file"
  gunzip -c "$file" | psql --quiet --single-transaction --set ON_ERROR_STOP=1 -o /dev/null
  log "restauration terminée"
}

case "${1:-run}" in
  run)
    log "démarrage: dump toutes les ${BACKUP_INTERVAL_HOURS}h, rétention ${BACKUP_RETENTION_DAYS}j"
    while true; do
      if backup_once; then
        sleep "$((BACKUP_INTERVAL_HOURS * 3600))"
      else
        log "nouvelle tentative dans 60 s"
        sleep 60
      fi
    done
    ;;
  once) backup_once ;;
  list) list_backups ;;
  restore) shift; restore "$@" ;;
  *) echo "usage: $0 {run|once|list|restore [fichier]}" >&2; exit 2 ;;
esac
