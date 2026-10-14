# Health check, page de statut, sauvegardes et reprise

**Type** : Minor (1 pt)  ·  **Sujet** : IV.7 DevOps — « Health check and status page system with automated backups and disaster recovery procedures »  ·  **Tag dans le code** : `[Minor · Health check et sauvegardes]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Minor · Health check et sauvegardes] … */` : cherchez `[Minor · Health check et sauvegardes]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Health check.
- Page de statut.
- Sauvegardes automatisées.
- Procédure de reprise après sinistre.

## Ce qui est implémenté

`GET /health` (public) interroge réellement la base (latence), vérifie la fraîcheur de la dernière sauvegarde et répond **503** si la base est en panne ; la page publique `/status` se rafraîchit toutes les 15 s ; un service Docker `backup` sauvegarde PostgreSQL toutes les 24 h (rétention 7 jours) ; un script restaure de façon transactionnelle.

## Logique utilisée

1. `HealthService.check` agrège `checkDatabase` (requête réelle + temps de réponse) et `checkBackups` (âge du dernier dump vs `BACKUP_MAX_AGE_HOURS`) ; le contrôleur renvoie 503 avec le rapport quand la base est KO.
2. **Front** : `Status.tsx` interroge `/health` (polling 15 s) et affiche l'état de l'API, de la base et des sauvegardes (uptime, taille, âge).
3. **Sauvegardes** : `scripts/db-backup.sh` (mode `once`, `list`, `restore`) tourne dans le conteneur `backup` ; `scripts/db-restore.sh` arrête le backend, restaure, relance. Healthchecks Docker sur db/backend/frontend.
4. Reprise après sinistre : `make db-restore` (ou `scripts/db-restore.sh`) restaure un dump choisi dans `make db-backups`. Commandes : `make db-backup`, `make db-backups`, `make db-restore`.

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/health%20status/health.controller.ts`](../../backend/src/health%20status/health.controller.ts)**

- `HealthController` ([l.5](../../backend/src/health%20status/health.controller.ts#L5)) — Contrôleur HTTP du health check : routes REST protégées par les guards d'authentification.
- `check` ([l.11](../../backend/src/health%20status/health.controller.ts#L11)) — GET /health : public (utilisé par Docker et la page de statut).

**[`backend/src/health%20status/health.module.ts`](../../backend/src/health%20status/health.module.ts)**

- `HealthModule` ([l.7](../../backend/src/health%20status/health.module.ts#L7)) — Module NestJS du health check : regroupe contrôleur, services et dépendances.

**[`backend/src/health%20status/health.service.ts`](../../backend/src/health%20status/health.service.ts)**

- `HealthReport` ([l.9](../../backend/src/health%20status/health.service.ts#L9)) — Rapport de santé : statut global, base, sauvegardes, uptime.
- `HealthService` ([l.32](../../backend/src/health%20status/health.service.ts#L32)) — Service métier du health check.
- `check` ([l.38](../../backend/src/health%20status/health.service.ts#L38)) — Rapport d'état : API, base de données (requête réelle + latence) et sauvegardes (dernier dump trop ancien ou absent = dégradé).
- `checkDatabase` ([l.58](../../backend/src/health%20status/health.service.ts#L58)) — Exécute `SELECT 1` avec un délai maximal et mesure la latence.
- `checkBackups` ([l.80](../../backend/src/health%20status/health.service.ts#L80)) — Lit le dossier des sauvegardes (monté en lecture seule) : nombre de dumps, date et taille du plus récent.

### Frontend (React)

**[`frontend/src/features/health/healthApi.ts`](../../frontend/src/features/health/healthApi.ts)**

- `healthApi` ([l.24](../../frontend/src/features/health/healthApi.ts#L24)) — Endpoints RTK Query du domaine « health » (requêtes/mutations typées, cache et invalidation par tags) : GET_HEALTH.

**[`frontend/src/pages/Status.tsx`](../../frontend/src/pages/Status.tsx)**

- `formatUptime` ([l.22](../../frontend/src/pages/Status.tsx#L22)) — 3661 -> « 1 h 1 min » ; en dessous d'une minute, en secondes.
- `formatSize` ([l.33](../../frontend/src/pages/Status.tsx#L33)) — Formate une taille en octets (KB ou MB) pour la sauvegarde.
- `ServiceRow` ([l.40](../../frontend/src/pages/Status.tsx#L40)) — Ligne d'un service (base, sauvegarde…) avec son état coloré et ses détails.
- `Status` ([l.74](../../frontend/src/pages/Status.tsx#L74)) — Page publique /status : interroge GET /health toutes les 15 s et affiche l'état de l'API, de la base et des sauvegardes.

### Autres fichiers liés

- `scripts/db-backup.sh` — Sauvegarde PostgreSQL (once/list/restore), rétention 7 jours.
- `scripts/db-restore.sh` — Restauration transactionnelle (arrête le backend, restaure, relance).
- `docker-compose.yml` — Service `backup` et healthchecks db/backend/frontend.

## Comment le démontrer

- Ouvrir /status ; `make db-backup` puis `make db-backups` ; couper la base pour voir l'état passer en erreur.
