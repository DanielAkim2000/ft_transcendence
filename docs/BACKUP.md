# Health check, backups & disaster recovery

Module **Health check and status page with automated backups and disaster recovery** (Minor, 1 pt).

## Health check

- `GET /health` (public, `backend/src/health/`) runs a real `SELECT 1` against PostgreSQL (3 s timeout, latency measured) and inspects the backup folder. Behind nginx it is `https://localhost:8443/api/health`.
  - `status: "ok"` — API and database up, last backup recent.
  - `status: "degraded"` — API and database up but the last backup is older than `BACKUP_MAX_AGE_HOURS` (default 36 h) or missing. HTTP 200.
  - `status: "down"` — database unreachable. HTTP **503**.
- **Status page**: `/status` (public, linked from the footer next to Privacy / Terms). Shows API, database and backups state, refreshed every 15 s.
- **Docker healthchecks** (`docker-compose.yml`): `db` (`pg_isready`), `backend` (`/health`), `frontend` (HTTPS on the container). `docker compose ps` shows `healthy` / `unhealthy`.

## Automated backups

The `backup` service (`postgres:16-alpine`, script [`scripts/db-backup.sh`](../scripts/db-backup.sh)):

- runs `pg_dump --clean --if-exists` immediately at start, then every `BACKUP_INTERVAL_HOURS` (default 24);
- stores gzip-compressed, timestamped dumps in the `db_backups` volume (`/backups`): `ft_transcendence_YYYYMMDD_HHMMSS.sql.gz`;
- writes to a `.tmp` file and renames it, so an interrupted dump is never listed;
- deletes dumps older than `BACKUP_RETENTION_DAYS` (default 7), always keeping the most recent one.

Configuration (all optional, in `.env`): `BACKUP_INTERVAL_HOURS`, `BACKUP_RETENTION_DAYS`, `BACKUP_MAX_AGE_HOURS`.

```sh
docker compose exec backup /db-backup.sh once   # take a backup now
docker compose exec backup /db-backup.sh list   # list backups (newest first)
```

Copy a backup out of the volume (off-site copy):

```sh
docker compose cp backup:/backups/<file>.sql.gz .
```

## Disaster recovery procedure

Scenario: data lost or corrupted (bad migration, accidental delete, wiped volume).

1. Check the situation: `docker compose ps`, `/status`, `docker compose exec backup /db-backup.sh list`.
2. Restore: `./scripts/db-restore.sh` (latest backup) or `./scripts/db-restore.sh <file>.sql.gz`. Use `COMPOSE_FILE=docker-compose.dev.yml` for the dev stack. The script asks for confirmation, stops the backend, restores the dump in **one transaction** (on error the database is left untouched), then restarts the backend, which replays pending migrations.
3. Verify: `/status` is green and the data is back.
4. If the whole volume was lost (`docker compose down -v`): `docker compose up -d db backup`, copy your off-site dump back with `docker compose cp <file> backup:/backups/`, then run step 2.

Notes:
- `RUN_SEED=true` (default in dev) re-creates the demo accounts each time the backend starts; set `RUN_SEED=false` in `.env` before restoring real data.
- Only the database is dumped. Uploaded avatars live in the `backend_uploads` volume: back it up separately (`docker run --rm -v ft_transcendence_backend_uploads:/u -v "$PWD":/b alpine tar czf /b/uploads.tgz -C /u .`).
- The 42 OAuth secret and JWT secrets are Docker secrets (`./secrets/`), not part of the dump: keep them safe separately.
