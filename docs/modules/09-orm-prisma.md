# ORM Prisma

**Type** : Minor (1 pt)  ·  **Sujet** : IV.1 Web — « Use an ORM for the database »  ·  **Tag dans le code** : `[Minor · ORM Prisma]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Minor · ORM Prisma] … */` : cherchez `[Minor · ORM Prisma]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Utiliser un ORM pour accéder à la base.

## Ce qui est implémenté

Toute la persistance passe par **Prisma 7** (adaptateur `pg`) sur PostgreSQL : un seul `schema.prisma`, un client généré, des migrations versionnées et un script de seed.

## Logique utilisée

1. `PrismaModule` fournit l'adaptateur PostgreSQL (`DATABASE_URL`, échec au démarrage si absente) et exporte `PrismaService` (un `PrismaClient` qui se connecte à l'init et se déconnecte à l'arrêt).
2. Les **repositories** de chaque domaine encapsulent les requêtes typées ; les opérations multi-tables utilisent `$transaction` (ex. coup d'échecs + mise à jour de la partie, application de l'Elo).
3. `schema.prisma` décrit utilisateurs, amitiés, chat, tables/file, matchs, tournois, badges, notifications et échecs ; `prisma/migrations` contient les migrations (y compris SQL écrit à la main pour les contraintes que le DSL ne sait pas exprimer) ; `seed.ts` crée des comptes de démo.

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/prisma/prisma.module.ts`](../../backend/src/prisma/prisma.module.ts)**

- `PrismaModule` ([l.8](../../backend/src/prisma/prisma.module.ts#L8)) — Module NestJS de l'accès à la base : regroupe contrôleur, services et dépendances.

**[`backend/src/prisma/prisma.service.ts`](../../backend/src/prisma/prisma.service.ts)**

- `PrismaService` ([l.11](../../backend/src/prisma/prisma.service.ts#L11)) — Service métier de l'accès à la base.
- `constructor` ([l.17](../../backend/src/prisma/prisma.service.ts#L17)) — Injecte les dépendances : PrismaPg.
- `onModuleInit` ([l.25](../../backend/src/prisma/prisma.service.ts#L25)) — Ouvre la connexion à la base au démarrage du module.
- `onModuleDestroy` ([l.30](../../backend/src/prisma/prisma.service.ts#L30)) — Ferme la connexion à la base à l'arrêt du module.

### Autres fichiers liés

- `backend/prisma/schema.prisma` — Schéma unique : tous les modèles et enums (chaque modèle porte le tag de son module).
- `backend/prisma/migrations/` — Migrations versionnées (dont SQL écrit à la main).
- `backend/prisma/seed.ts + run-seed.cjs` — Données de démo (comptes `seed_*`).
- `backend/prisma.config.ts` — Configuration de la CLI Prisma.
- `backend/src/**/repositories/*.repository.ts` — Tous les repositories utilisent `PrismaService` : requêtes typées et transactions.

## Comment le démontrer

- Montrer `schema.prisma`, une migration, et un repository.
