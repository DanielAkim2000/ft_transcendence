# Système de permissions avancé (rôles, CRUD admin, bannissements)

**Type** : Major (2 pts)  ·  **Sujet** : IV.3 User Management — « Advanced permissions system »  ·  **Tag dans le code** : `[Major · Permissions avancées]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Major · Permissions avancées] … */` : cherchez `[Major · Permissions avancées]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Voir, créer, modifier et supprimer des utilisateurs (CRUD).
- Gestion de rôles (admin, user…).
- Vues et actions différentes selon le rôle.

## Ce qui est implémenté

Deux rôles (`ADMIN`, `USER`) appliqués par un **RolesGuard** côté API et par des routes/menus conditionnels côté UI. Les administrateurs disposent d'un CRUD complet des utilisateurs, de la gestion des tables, des bannissements, de corrections de scores de tournoi et de libération forcée des tables.

## Logique utilisée

1. **API** : `@Roles(Role.ADMIN)` / `@AuthRoles(...)` posent la métadonnée ; `RolesGuard.canActivate` la lit et renvoie 401 (pas d'utilisateur) ou 403 `INSUFFICIENT_RIGHTS`. Contrôleur `admin/users` : liste paginée, lecture, création, modification (rôle compris), suppression, avec garde-fous (`assertAnotherAdminRemains` : on ne supprime/rétrograde pas le dernier admin ; `assertEmailAvailable`).
2. **Bannissements** : `BanService.banUser` (durée en heures ou permanent + motif), `unbanUser`, historique ; un utilisateur banni est refusé à la connexion/au refresh (`assertNotBanned`), reçoit un email, et ses sockets sont coupés en direct (`kickBannedUser` + événement `auth:banned`) ; l'UI le renvoie sur la page de connexion avec l'explication.
3. **UI** : `RequireAdmin` n'affiche les routes `/admin/*` qu'aux admins ; la sidebar n'ajoute le groupe « Admin » que si `role === 'ADMIN'` ; certaines cartes affichent des actions admin (corriger un score, libérer une table).

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/admin/admin-users.controller.ts`](../../backend/src/admin/admin-users.controller.ts)**

- `AdminUsersController` ([l.22](../../backend/src/admin/admin-users.controller.ts#L22)) — Contrôleur HTTP de l'administration des utilisateurs (CRUD réservé aux admins) : routes REST protégées par les guards d'authentification.
- `list` ([l.29](../../backend/src/admin/admin-users.controller.ts#L29)) — GET /admin/users?q=&page=&limit= : page d'utilisateurs, recherche par nom, email ou login 42.
- `getOne` ([l.35](../../backend/src/admin/admin-users.controller.ts#L35)) — GET /admin/users/:id : détail d'un utilisateur.
- `create` ([l.41](../../backend/src/admin/admin-users.controller.ts#L41)) — POST /admin/users : crée un compte.
- `update` ([l.47](../../backend/src/admin/admin-users.controller.ts#L47)) — PATCH /admin/users/:id : modifie nom, email, rôle ou mot de passe.
- `remove` ([l.57](../../backend/src/admin/admin-users.controller.ts#L57)) — DELETE /admin/users/:id : supprime (anonymise) le compte, comme le fait l'utilisateur lui-même.

**[`backend/src/admin/admin.module.ts`](../../backend/src/admin/admin.module.ts)**

- `AdminModule` ([l.10](../../backend/src/admin/admin.module.ts#L10)) — Module NestJS de l'administration des utilisateurs (CRUD réservé aux admins) : regroupe contrôleur, services et dépendances.

**[`backend/src/admin/dtos/admin-users-query.dto.ts`](../../backend/src/admin/dtos/admin-users-query.dto.ts)**

- `AdminUsersQueryDto` ([l.5](../../backend/src/admin/dtos/admin-users-query.dto.ts#L5)) — Paramètres validés de la liste admin des utilisateurs (pagination, recherche, filtre de rôle).

**[`backend/src/admin/dtos/create-admin-user.dto.ts`](../../backend/src/admin/dtos/create-admin-user.dto.ts)**

- `CreateAdminUserDto` ([l.13](../../backend/src/admin/dtos/create-admin-user.dto.ts#L13)) — Corps validé de création d'un utilisateur par un administrateur.

**[`backend/src/admin/repositories/admin-users.repository.ts`](../../backend/src/admin/repositories/admin-users.repository.ts)**

- `activeBan` ([l.29](../../backend/src/admin/repositories/admin-users.repository.ts#L29)) — Ban en cours : permanent (pas de date de fin) ou pas encore terminé.
- `adminSelectWithBan` ([l.34](../../backend/src/admin/repositories/admin-users.repository.ts#L34)) — Construit le `select` Prisma d'un utilisateur côté admin, enrichi de son ban actif le plus récent.
- `AdminUsersRepository` ([l.71](../../backend/src/admin/repositories/admin-users.repository.ts#L71)) — Dépôt de données de l'administration des utilisateurs (CRUD réservé aux admins) : requêtes Prisma et conversion en entités.
- `list` ([l.77](../../backend/src/admin/repositories/admin-users.repository.ts#L77)) — Une page d'utilisateurs actifs (comptes supprimés exclus) filtrés par nom, email ou login 42, triés par nom, plus le total.
- `findById` ([l.110](../../backend/src/admin/repositories/admin-users.repository.ts#L110)) — Retrouve un utilisateur actif par id, ou null (inconnu ou supprimé).
- `findIdByEmail` ([l.119](../../backend/src/admin/repositories/admin-users.repository.ts#L119)) — Retrouve l'id d'un utilisateur par email exact (colonne unique), ou null.
- `countAdmins` ([l.128](../../backend/src/admin/repositories/admin-users.repository.ts#L128)) — Nombre d'administrateurs actifs.
- `create` ([l.135](../../backend/src/admin/repositories/admin-users.repository.ts#L135)) — Crée un utilisateur avec mot de passe déjà haché et rôle donné.
- `update` ([l.149](../../backend/src/admin/repositories/admin-users.repository.ts#L149)) — Met à jour les champs fournis ; si le mot de passe change, révoque toutes les sessions (refresh tokens) et jetons de réinitialisation, dans la même t…
- `toView` ([l.174](../../backend/src/admin/repositories/admin-users.repository.ts#L174)) — Convertit une ligne Prisma en vue d'administration (sans hash).

**[`backend/src/admin/services/admin-users.service.ts`](../../backend/src/admin/services/admin-users.service.ts)**

- `AdminUsersService` ([l.19](../../backend/src/admin/services/admin-users.service.ts#L19)) — Service métier de l'administration des utilisateurs (CRUD réservé aux admins).
- `constructor` ([l.22](../../backend/src/admin/services/admin-users.service.ts#L22)) — Injecte les dépendances : AdminUsersRepository, GdprService.
- `list` ([l.28](../../backend/src/admin/services/admin-users.service.ts#L28)) — Une page d'utilisateurs, avec recherche par nom, email ou login 42.
- `getById` ([l.38](../../backend/src/admin/services/admin-users.service.ts#L38)) — Retrouve un utilisateur actif ou lève une NotFoundException.
- `create` ([l.50](../../backend/src/admin/services/admin-users.service.ts#L50)) — Crée un compte (mot de passe haché, rôle USER par défaut) ; lève une ConflictException si l'email est déjà pris.
- `update` ([l.61](../../backend/src/admin/services/admin-users.service.ts#L61)) — Modifie les champs fournis.
- `remove` ([l.92](../../backend/src/admin/services/admin-users.service.ts#L92)) — Supprime (anonymise) un compte avec les mêmes règles que la suppression par l'utilisateur (tournoi ou partie en cours = refus).
- `assertEmailAvailable` ([l.107](../../backend/src/admin/services/admin-users.service.ts#L107)) — Lève une ConflictException si un autre compte utilise déjà cet email.
- `assertAnotherAdminRemains` ([l.117](../../backend/src/admin/services/admin-users.service.ts#L117)) — Lève une ConflictException s'il n'y a qu'un seul administrateur (celui-ci ne peut pas disparaître).

**[`backend/src/auth/auth.controller.ts`](../../backend/src/auth/auth.controller.ts)**

- `adminOnly` ([l.216](../../backend/src/auth/auth.controller.ts#L216)) — GET /auth/admin : route de test réservée aux administrateurs.

**[`backend/src/auth/auth.service.ts`](../../backend/src/auth/auth.service.ts)**

- `assertNotBanned` ([l.79](../../backend/src/auth/auth.service.ts#L79)) — Lève une ForbiddenException (code BAN, motif et date de fin, null si permanent) si l'utilisateur est banni : le client peut ainsi expliquer le ban au…

**[`backend/src/auth/decorators/auth-roles.decorator.ts`](../../backend/src/auth/decorators/auth-roles.decorator.ts)**

- `AuthRoles` ([l.7](../../backend/src/auth/decorators/auth-roles.decorator.ts#L7)) — Décorateur combiné : exige un access token valide et l'un des rôles donnés.

**[`backend/src/auth/decorators/roles.decorator.ts`](../../backend/src/auth/decorators/roles.decorator.ts)**

- `Roles` ([l.6](../../backend/src/auth/decorators/roles.decorator.ts#L6)) — Décorateur qui enregistre les rôles autorisés sur une route (lus ensuite par RolesGuard).

**[`backend/src/auth/guards/roles.guard.ts`](../../backend/src/auth/guards/roles.guard.ts)**

- `RolesGuard` ([l.13](../../backend/src/auth/guards/roles.guard.ts#L13)) — Guard de rôles : n'autorise la route que si l'utilisateur possède l'un des rôles déclarés par @Roles / @AuthRoles (403 sinon).
- `canActivate` ([l.19](../../backend/src/auth/guards/roles.guard.ts#L19)) — Autorise la requête si la route n'exige aucun rôle ou si l'utilisateur authentifié possède l'un des rôles requis ; 401 sans utilisateur, 403 sinon.

**[`backend/src/ban/ban.controller.ts`](../../backend/src/ban/ban.controller.ts)**

- `BanController` ([l.7](../../backend/src/ban/ban.controller.ts#L7)) — Contrôleur HTTP des bannissements : routes REST protégées par les guards d'authentification.
- `getActiveBan` ([l.14](../../backend/src/ban/ban.controller.ts#L14)) — GET /ban/:userId : ban en cours de l'utilisateur (`ban` vaut null s'il n'est pas banni).
- `getBanHistory` ([l.20](../../backend/src/ban/ban.controller.ts#L20)) — GET /ban/:userId/history : tous les bans de l'utilisateur, du plus récent au plus ancien.
- `ban` ([l.26](../../backend/src/ban/ban.controller.ts#L26)) — POST /ban/:userId : bannit l'utilisateur (durationHours = 0 pour un ban permanent).
- `unban` ([l.32](../../backend/src/ban/ban.controller.ts#L32)) — POST /ban/:userId/unban : lève le ban en cours.

**[`backend/src/ban/ban.messages.ts`](../../backend/src/ban/ban.messages.ts)**

- `Mail` ([l.3](../../backend/src/ban/ban.messages.ts#L3)) — Contenu d'un email (sujet, texte) dans une langue.
- `untilLabel` ([l.9](../../backend/src/ban/ban.messages.ts#L9)) — Date de fin de ban lisible, en UTC (null = ban permanent).

**[`backend/src/ban/ban.module.ts`](../../backend/src/ban/ban.module.ts)**

- `BanModule` ([l.10](../../backend/src/ban/ban.module.ts#L10)) — Module NestJS des bannissements : regroupe contrôleur, services et dépendances.

**[`backend/src/ban/dto/create-ban.dto.ts`](../../backend/src/ban/dto/create-ban.dto.ts)**

- `CreateBanDto` ([l.14](../../backend/src/ban/dto/create-ban.dto.ts#L14)) — Corps validé d'un bannissement (durée en heures, motif).

**[`backend/src/ban/repositories/ban.repository.ts`](../../backend/src/ban/repositories/ban.repository.ts)**

- `BanRepository` ([l.8](../../backend/src/ban/repositories/ban.repository.ts#L8)) — Dépôt de données des bannissements : requêtes Prisma et conversion en entités.
- `findActiveBan` ([l.14](../../backend/src/ban/repositories/ban.repository.ts#L14)) — Retourne le ban en cours de l'utilisateur (permanent ou pas encore terminé), le plus récent d'abord, ou null.
- `findBans` ([l.25](../../backend/src/ban/repositories/ban.repository.ts#L25)) — Historique complet des bans de l'utilisateur, du plus récent au plus ancien.
- `create` ([l.33](../../backend/src/ban/repositories/ban.repository.ts#L33)) — Crée le ban (durée 0 = permanent) et révoque toutes les sessions de l'utilisateur (refresh tokens), dans la même transaction.
- `unbanUser` ([l.51](../../backend/src/ban/repositories/ban.repository.ts#L51)) — Termine immédiatement les bans en cours de l'utilisateur ; retourne le nombre de bans levés.

**[`backend/src/ban/services/ban.service.ts`](../../backend/src/ban/services/ban.service.ts)**

- `BanService` ([l.19](../../backend/src/ban/services/ban.service.ts#L19)) — Service métier des bannissements.
- `constructor` ([l.22](../../backend/src/ban/services/ban.service.ts#L22)) — Injecte les dépendances : BanRepository, UsersService, MailService, PresenceGateway.
- `mailLanguage` ([l.31](../../backend/src/ban/services/ban.service.ts#L31)) — Langue des emails de l'utilisateur, avec repli sur l'anglais.
- `findActiveBan` ([l.38](../../backend/src/ban/services/ban.service.ts#L38)) — Retourne le ban en cours de l'utilisateur, ou null.
- `findBans` ([l.43](../../backend/src/ban/services/ban.service.ts#L43)) — Historique des bans de l'utilisateur, du plus récent au plus ancien.
- `banUser` ([l.48](../../backend/src/ban/services/ban.service.ts#L48)) — Bannit un utilisateur : refuse un administrateur ou un utilisateur déjà banni, révoque ses sessions, le déconnecte en temps réel et l'informe par ema…
- `unbanUser` ([l.84](../../backend/src/ban/services/ban.service.ts#L84)) — Lève le ban en cours ; lève une NotFoundException si l'utilisateur n'est pas banni.

### Frontend (React)

**[`frontend/src/features/admin/UserFormDialog.tsx`](../../frontend/src/features/admin/UserFormDialog.tsx)**

- `UserFormDialog` ([l.32](../../frontend/src/features/admin/UserFormDialog.tsx#L32)) — Formulaire (en fenêtre) de création ou de modification d'un compte par un administrateur.

**[`frontend/src/features/admin/adminApi.ts`](../../frontend/src/features/admin/adminApi.ts)**

- `adminApi` ([l.50](../../frontend/src/features/admin/adminApi.ts#L50)) — Endpoints RTK Query du domaine « admin » (requêtes/mutations typées, cache et invalidation par tags) : LIST_USERS, CREATE_USER, UPDATE_USER, DELETE_U…

**[`frontend/src/features/ban/BanDialog.tsx`](../../frontend/src/features/ban/BanDialog.tsx)**

- `BanPeriod` ([l.33](../../frontend/src/features/ban/BanDialog.tsx#L33)) — Texte de durée d'un ban terminé ou en cours (« jusqu'au … » ou « permanent »).
- `BanForm` ([l.47](../../frontend/src/features/ban/BanDialog.tsx#L47)) — Formulaire de bannissement : durée (préréglée ou personnalisée) et motif obligatoire.
- `handleBan` ([l.70](../../frontend/src/features/ban/BanDialog.tsx#L70)) — Envoie le ban (durée en heures + motif) et confirme par un toast.
- `BanDialog` ([l.179](../../frontend/src/features/ban/BanDialog.tsx#L179)) — Fenêtre de modération d'un utilisateur : état du ban, formulaire de ban (durées prédéfinies + motif), levée du ban et historique.
- `handleUnban` ([l.190](../../frontend/src/features/ban/BanDialog.tsx#L190)) — Lève le ban d'un utilisateur et confirme par un toast.

**[`frontend/src/features/ban/BanNotice.tsx`](../../frontend/src/features/ban/BanNotice.tsx)**

- `BanNotice` ([l.10](../../frontend/src/features/ban/BanNotice.tsx#L10)) — Bandeau (page de connexion) qui explique à un utilisateur banni pourquoi il ne peut pas se connecter et jusqu'à quand.

**[`frontend/src/features/ban/banApi.tsx`](../../frontend/src/features/ban/banApi.tsx)**

- `banApi` ([l.22](../../frontend/src/features/ban/banApi.tsx#L22)) — Endpoints RTK Query du domaine « ban » (requêtes/mutations typées, cache et invalidation par tags) : GET_ACTIVE_BAN, GET_BAN_HISTORY, BAN_USER, UNBAN…

**[`frontend/src/features/ban/banHelpers.ts`](../../frontend/src/features/ban/banHelpers.ts)**

- `formatBanDate` ([l.17](../../frontend/src/features/ban/banHelpers.ts#L17)) — Date et heure lisibles dans la langue de l'interface.
- `isBanActive` ([l.25](../../frontend/src/features/ban/banHelpers.ts#L25)) — Vrai tant que le ban n'est pas terminé (permanent ou date de fin dans le futur).
- `banLoginPath` ([l.30](../../frontend/src/features/ban/banHelpers.ts#L30)) — Page de connexion qui affiche le bandeau de ban (motif et date de fin en paramètres d'URL).

**[`frontend/src/features/presence/PresenceBootstrap.tsx`](../../frontend/src/features/presence/PresenceBootstrap.tsx)**

- `onBanned` ([l.68](../../frontend/src/features/presence/PresenceBootstrap.tsx#L68)) — L'utilisateur vient d'être banni : vide la session, prévient et redirige vers la page de connexion expliquant le ban.

**[`frontend/src/layouts/RequireAdmin.tsx`](../../frontend/src/layouts/RequireAdmin.tsx)**

- `RequireAdmin` ([l.6](../../frontend/src/layouts/RequireAdmin.tsx#L6)) — Réserve les routes enfants aux administrateurs (les autres sont renvoyés à l'accueil ; le backend refuse de toute façon les appels).

**[`frontend/src/pages/AdminTables.tsx`](../../frontend/src/pages/AdminTables.tsx)**

- `AdminTables` ([l.21](../../frontend/src/pages/AdminTables.tsx#L21)) — Gestion des tables par un administrateur : création, renommage et suppression (uniquement si la table n'est pas utilisée).
- `run` ([l.32](../../frontend/src/pages/AdminTables.tsx#L32)) — Exécute une action d'administration sur les tables avec toast de succès ou d'erreur ; renvoie vrai si elle a réussi.
- `handleCreate` ([l.47](../../frontend/src/pages/AdminTables.tsx#L47)) — Crée une table avec le nom saisi (non vide) et vide le champ.
- `startEditing` ([l.56](../../frontend/src/pages/AdminTables.tsx#L56)) — Passe une table en mode renommage en pré-remplissant son nom.
- `handleRename` ([l.62](../../frontend/src/pages/AdminTables.tsx#L62)) — Enregistre le nouveau nom de la table (ignore un nom vide ou inchangé).

**[`frontend/src/pages/AdminUsers.tsx`](../../frontend/src/pages/AdminUsers.tsx)**

- `AdminUsers` ([l.26](../../frontend/src/pages/AdminUsers.tsx#L26)) — Gestion des comptes par un administrateur : recherche, création, modification et suppression.
- `handleDelete` ([l.43](../../frontend/src/pages/AdminUsers.tsx#L43)) — Supprime un utilisateur (confirmation préalable) et affiche un toast.

**[`frontend/src/pages/BanPanel.tsx`](../../frontend/src/pages/BanPanel.tsx)**

- `BanPanel` ([l.20](../../frontend/src/pages/BanPanel.tsx#L20)) — Modération (admin) : recherche d'utilisateurs, état de leur ban et ouverture de la fenêtre de gestion (bannir, débannir, historique).

### Base de données

**[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)**

- `Role` ([l.11](../../backend/prisma/schema.prisma#L11)) — Rôles ADMIN / USER : pilotent les vues et actions autorisées.
- `Ban` ([l.252](../../backend/prisma/schema.prisma#L252)) — Bannissements (durée, motif, auteur).

## Comment le démontrer

- Se connecter en admin : créer/modifier/supprimer un utilisateur, le bannir puis le débannir ; vérifier qu'un compte `USER` reçoit 403 et n'a pas le menu admin.

## Points à connaître / limites

- Seulement deux rôles (admin/user) ; pas de rôle modérateur ou invité.
