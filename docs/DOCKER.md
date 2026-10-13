# Docker : comment le projet tourne

Ce fichier resume les deux configurations Docker du projet. Le but est de retrouver
rapidement quel service fait quoi, sans avoir a relire tous les Dockerfiles.

## Les conteneurs

- `db` : PostgreSQL 16. Les donnees sont gardees dans un volume.
- `backend` : NestJS. L'entrypoint charge les secrets, lance Prisma et demarre Node.
- `frontend` : Vite en dev, ou nginx qui sert le front compile en prod.
- `mailpit` : recoit les mails de test sur l'interface du port 8025 par defaut.
- `backup` : cree des dumps `.sql.gz` de la base, par defaut toutes les 24 h.

Les services peuvent s'appeler par leur nom sur le reseau Docker. Par exemple,
le backend utilise `db:5432` pour PostgreSQL, pas `localhost:5432`.

## Les deux modes

| | Dev | Prod |
| --- | --- | --- |
| Compose | `docker-compose.dev.yml` | `docker-compose.yml` |
| Variables | `.env.dev` | `.env.prod` |
| Frontend | Vite, port 5173 | nginx, HTTPS port 8443 |
| Backend | Mode watch, port 5000 publie | Build Node, passe par nginx |
| Base | `postgres_data_dev` | `postgres_data` |
| Uploads | Dossier local `backend/uploads` | `backend_uploads` |
| Dumps | `db_backups_dev` | `db_backups` |

En prod, nginx sert les fichiers du frontend. Il redirige `/api/` vers le
backend et fait aussi passer Socket.IO via `/api/socket.io/`.
Le port HTTP 8080 redirige vers HTTPS 8443 avec les valeurs par defaut.

Le certificat est autosigne pour le developpement local. Le script
`frontend/docker-entrypoint.d-generate-cert.sh` le cree s'il manque.
Le volume `tls_certs` permet de garder les fichiers apres recreation du conteneur.
Ce n'est pas un certificat public valide pour Internet.

## Premier lancement

Depuis la racine du depot :

```bash
cp .env.example .env.dev
cp .env.example .env.prod
```

Configurer ensuite les deux fichiers et les secrets dans `secrets/`.
Les secrets obligatoires sont `postgres_password`, `jwt_access_token_secret`,
`jwt_refresh_token_secret`, `jwt_pre_auth_token_secret`, `client_secret`
(pour prod) et `client_secret.dev` (pour dev).
Les valeurs OAuth doivent correspondre a l'application creee sur l'intra 42.
Ne jamais commit les vrais secrets ou les fichiers `.env.dev`/`.env.prod`.

`make setup` peut preparer ces fichiers depuis les exemples du dossier `secrets/`.
**Attention : dans le ZIP recu, il n'y a que `secrets/.gitkeep`, pas de
`secrets/*.example`.** Le script peut donc echouer sur une installation neuve.
Il faut disposer des fichiers de secrets attendus avant de lancer les conteneurs.
On n'a pas modifie ce script pour corriger ce point dans cette reformulation.

La valeur `NODE_ENV=production` du modele est adaptee a la prod. Dans
`.env.dev`, mettre `NODE_ENV=development`, sinon la configuration Compose de dev
reprend la valeur `production` du fichier.

Pour demarrer :

```bash
make dev
# ou, pour lancer le build avec nginx :
make prod
```

`make dev` arrete la stack prod avant de lancer la dev, et `make prod` fait
l'inverse. Verifier ce qui tourne deja avant de lancer ces raccourcis.

## Quelques commandes

```bash
make ps ENV=dev
make logs ENV=dev S=backend
make ps ENV=prod
make logs ENV=prod S=frontend
```

Si on veut lancer Compose a la main, donner le fichier d'environnement :

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml config --quiet
docker compose --env-file .env.prod -f docker-compose.yml config --quiet
```

## Volumes et sauvegardes

La base est dans un volume : supprimer le conteneur ne supprime pas normalement
les donnees. Les volumes de dev et de prod restent separes.

Le conteneur `backup` garde ses dumps dans un autre volume. La retention
est reglee par `BACKUP_RETENTION_DAYS` (7 jours par defaut), avec conservation
du dernier dump. Le script `scripts/db-restore.sh` demande une confirmation
avant de restaurer et remplace les donnees presentes.

Ne pas utiliser `docker compose down -v` juste pour redemarrer : cette option
peut supprimer les volumes de base et de sauvegarde.

## Ou regarder en cas de probleme ?

- `make ps ENV=dev` : voir quels services tournent.
- `make logs ENV=dev S=backend` : erreurs backend, migrations et Prisma.
- `make logs ENV=dev S=db` : logs de la base.
- `config --quiet` (avec `--env-file` et `-f`) : verifier Compose sans lancer.

La base a un healthcheck en dev et en prod. Le Compose de prod en a aussi pour
le frontend et le backend.

## Fichiers utiles

- `docker-compose.yml` / `docker-compose.dev.yml` : services, ports, volumes.
- `backend/Dockerfile*` / `frontend/Dockerfile*` : construction des images.
- `frontend/nginx.conf.template` : HTTPS, API et WebSockets.
- `frontend/docker-entrypoint.d-generate-cert.sh` : certificat de test.
- `backend/docker-entrypoint.sh` : secrets, Prisma, demarrage du backend.
- `scripts/setup-docker.sh`, `scripts/db-backup.sh`, `scripts/db-restore.sh` : scripts d'exploitation.
