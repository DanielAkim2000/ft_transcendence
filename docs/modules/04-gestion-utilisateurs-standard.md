# Gestion standard des utilisateurs et authentification

**Type** : Major (2 pts)  ·  **Sujet** : IV.3 User Management — « Standard user management and authentication »  ·  **Tag dans le code** : `[Major · Gestion des utilisateurs]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Major · Gestion des utilisateurs] … */` : cherchez `[Major · Gestion des utilisateurs]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Modifier son profil.
- Envoyer un avatar (avatar par défaut sinon).
- Ajouter des amis et voir leur statut en ligne.
- Page de profil.

## Ce qui est implémenté

Inscription/connexion email + mot de passe (bcrypt), session par **access token JWT (1 h)** + **refresh token** httpOnly tourné à chaque usage et stocké haché, réinitialisation du mot de passe par email, édition du profil, upload d'avatar (JPEG/PNG/WebP, 2 Mo), réglages persistés (thème, langue, accent, arrondi).

## Logique utilisée

1. **Inscription/connexion** : `AuthService.register` / `validateUserFromLogin` ; `createTokens` produit l'access token (renvoyé dans le JSON) et le refresh token (cookie httpOnly, `setRefreshCookie`). Le refresh token n'est jamais stocké en clair : `hashRefreshToken` (SHA) puis `rotateRefreshToken` à chaque `POST /auth/refresh`.
2. **Côté front** : `AuthBootstrap` tente un refresh au démarrage (uniquement si le témoin de session `sessionHint` existe, pour éviter un 401 inutile en console) ; `ProtectedLayout` redirige vers `/login` sans token ; `authSlice` garde l'access token en mémoire seulement.
3. **Mot de passe oublié** : `requestPasswordReset` envoie un lien à usage unique (jeton haché en base, anti-spam par délai) ; `resetPassword` le consomme, déconnecte toutes les sessions et prévient par email.
4. **Profil/avatar** : `PATCH /users/me`, `POST /users/me/avatar` (Multer : filtre MIME + limite de taille, fichier sur disque, URL servie par `/uploads`). Sans avatar, l'UI affiche les initiales (`getInitials`).
5. **Préférences** : `PATCH /users/me/settings`, appliquées immédiatement (Redux) puis persistées ; `SettingsBootstrap` réhydrate depuis `/auth/me` (la base fait foi).

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/auth/auth.controller.ts`](../../backend/src/auth/auth.controller.ts)**

- `AuthController` ([l.44](../../backend/src/auth/auth.controller.ts#L44)) — Contrôleur HTTP de l'authentification (inscription, connexion, tokens, mot de passe) : routes REST protégées par les guards d'authentification.
- `constructor` ([l.47](../../backend/src/auth/auth.controller.ts#L47)) — Injecte les dépendances : AuthService, ConfigService.
- `register` ([l.53](../../backend/src/auth/auth.controller.ts#L53)) — POST /auth/register : crée un compte (email, nom, mot de passe), pose le cookie de refresh token et retourne l'utilisateur avec son access token.
- `loginFromCredentials` ([l.70](../../backend/src/auth/auth.controller.ts#L70)) — POST /auth/login : vérifie email/mot de passe ; sans 2FA renvoie les tokens, avec 2FA pose un cookie de pré-authentification et attend le code.
- `refresh` ([l.142](../../backend/src/auth/auth.controller.ts#L142)) — POST /auth/refresh : fait tourner le refresh token du cookie et retourne un nouvel access token.
- `logout` ([l.169](../../backend/src/auth/auth.controller.ts#L169)) — POST /auth/logout : révoque le refresh token courant et efface les cookies d'authentification.
- `forgotPassword` ([l.193](../../backend/src/auth/auth.controller.ts#L193)) — POST /auth/forgot-password : public ; envoie un lien de réinitialisation si un compte correspond (réponse identique sinon, pour ne pas révéler les em…
- `resetPassword` ([l.201](../../backend/src/auth/auth.controller.ts#L201)) — POST /auth/reset-password : public (le jeton reçu par email fait foi) ; définit le nouveau mot de passe et déconnecte toutes les sessions.
- `me` ([l.209](../../backend/src/auth/auth.controller.ts#L209)) — GET /auth/me : retourne l'utilisateur authentifié.
- `cookiePath` ([l.324](../../backend/src/auth/auth.controller.ts#L324)) — Chemin des cookies d'auth.
- `useSecureCookies` ([l.329](../../backend/src/auth/auth.controller.ts#L329)) — Indique si les cookies doivent être « secure » (production ou frontend en https).
- `setRefreshCookie` ([l.338](../../backend/src/auth/auth.controller.ts#L338)) — Pose le cookie httpOnly du refresh token (durée depuis la config) et efface le cookie de pré-authentification.

**[`backend/src/auth/auth.messages.ts`](../../backend/src/auth/auth.messages.ts)**

- `Mail` ([l.3](../../backend/src/auth/auth.messages.ts#L3)) — Contenu d'un email (sujet, texte) dans une langue.

**[`backend/src/auth/auth.module.ts`](../../backend/src/auth/auth.module.ts)**

- `AuthModule` ([l.17](../../backend/src/auth/auth.module.ts#L17)) — Module NestJS de l'authentification (inscription, connexion, tokens, mot de passe) : regroupe contrôleur, services et dépendances.

**[`backend/src/auth/auth.service.ts`](../../backend/src/auth/auth.service.ts)**

- `AuthService` ([l.35](../../backend/src/auth/auth.service.ts#L35)) — Service métier de l'authentification (inscription, connexion, tokens, mot de passe).
- `constructor` ([l.40](../../backend/src/auth/auth.service.ts#L40)) — Injecte les dépendances : UsersService, JwtService, ConfigService, MailService.
- `register` ([l.49](../../backend/src/auth/auth.service.ts#L49)) — Crée l'utilisateur puis génère ses tokens de session.
- `createTokens` ([l.92](../../backend/src/auth/auth.service.ts#L92)) — Signe l'access token et le refresh token de l'utilisateur et stocke le hash du refresh token en base.
- `validateUserFromToken` ([l.167](../../backend/src/auth/auth.service.ts#L167)) — Retrouve l'utilisateur d'un payload JWT ou lève une UnauthorizedException.
- `validateUserFromLogin` ([l.180](../../backend/src/auth/auth.service.ts#L180)) — Vérifie email et mot de passe (bcrypt) et retourne l'utilisateur, sinon lève une UnauthorizedException.
- `revokeRefreshToken` ([l.395](../../backend/src/auth/auth.service.ts#L395)) — Supprime le refresh token en base ; lève une UnauthorizedException s'il n'existe pas.
- `assertRefreshTokenIsValid` ([l.412](../../backend/src/auth/auth.service.ts#L412)) — Vérifie que le refresh token existe en base et n'est pas expiré (il est supprimé s'il l'est).
- `rotateRefreshToken` ([l.436](../../backend/src/auth/auth.service.ts#L436)) — Contrôle et révoque l'ancien refresh token puis en génère une nouvelle paire.
- `mailLanguage` ([l.446](../../backend/src/auth/auth.service.ts#L446)) — Langue des emails de l'utilisateur, avec repli sur l'anglais.
- `requestPasswordReset` ([l.453](../../backend/src/auth/auth.service.ts#L453)) — Étape 1 de « mot de passe oublié » : si un compte à mot de passe existe pour cet email, envoie un lien à usage unique valable une heure.
- `resetPassword` ([l.477](../../backend/src/auth/auth.service.ts#L477)) — Étape 2 : vérifie le jeton reçu par email, définit le nouveau mot de passe, déconnecte toutes les sessions et prévient l'utilisateur par email.

**[`backend/src/auth/dtos/forgot-password.dto.ts`](../../backend/src/auth/dtos/forgot-password.dto.ts)**

- `ForgotPasswordDto` ([l.3](../../backend/src/auth/dtos/forgot-password.dto.ts#L3)) — Corps validé de la demande de réinitialisation (email).

**[`backend/src/auth/dtos/login.dto.ts`](../../backend/src/auth/dtos/login.dto.ts)**

- `LoginDto` ([l.10](../../backend/src/auth/dtos/login.dto.ts#L10)) — Corps validé de la connexion (email, mot de passe).

**[`backend/src/auth/dtos/register.dto.ts`](../../backend/src/auth/dtos/register.dto.ts)**

- `RegisterDto` ([l.8](../../backend/src/auth/dtos/register.dto.ts#L8)) — Corps validé de l'inscription (pseudo, email, mot de passe fort).

**[`backend/src/auth/dtos/reset-password.dto.ts`](../../backend/src/auth/dtos/reset-password.dto.ts)**

- `ResetPasswordDto` ([l.8](../../backend/src/auth/dtos/reset-password.dto.ts#L8)) — Corps validé de la réinitialisation (jeton, nouveau mot de passe).

**[`backend/src/auth/guards/access-token.guard.ts`](../../backend/src/auth/guards/access-token.guard.ts)**

- `AccessTokenGuard` ([l.11](../../backend/src/auth/guards/access-token.guard.ts#L11)) — Guard d'accès de l'authentification (inscription, connexion, tokens, mot de passe).
- `canActivate` ([l.14](../../backend/src/auth/guards/access-token.guard.ts#L14)) — Délègue la vérification du token à la stratégie Passport.
- `handleRequest` ([l.21](../../backend/src/auth/guards/access-token.guard.ts#L21)) — Retourne l'utilisateur validé ou lève une UnauthorizedException si le access token est invalide.

**[`backend/src/auth/guards/refresh-token.guard.ts`](../../backend/src/auth/guards/refresh-token.guard.ts)**

- `RefreshTokenGuard` ([l.11](../../backend/src/auth/guards/refresh-token.guard.ts#L11)) — Guard d'accès de l'authentification (inscription, connexion, tokens, mot de passe).
- `canActivate` ([l.14](../../backend/src/auth/guards/refresh-token.guard.ts#L14)) — Délègue la vérification du token à la stratégie Passport.
- `handleRequest` ([l.21](../../backend/src/auth/guards/refresh-token.guard.ts#L21)) — Retourne l'utilisateur validé ou lève une UnauthorizedException si le refresh token est invalide.

**[`backend/src/auth/strategies/access-token.strategy.ts`](../../backend/src/auth/strategies/access-token.strategy.ts)**

- `AccessTokenStrategy` ([l.17](../../backend/src/auth/strategies/access-token.strategy.ts#L17)) — Stratégie passport de l'authentification (inscription, connexion, tokens, mot de passe).
- `constructor` ([l.25](../../backend/src/auth/strategies/access-token.strategy.ts#L25)) — Injecte les dépendances : AuthService.
- `validate` ([l.41](../../backend/src/auth/strategies/access-token.strategy.ts#L41)) — Retrouve l'utilisateur du payload JWT de l'access token ; il devient req.user.

**[`backend/src/auth/strategies/refresh-token.strategy.ts`](../../backend/src/auth/strategies/refresh-token.strategy.ts)**

- `RefreshTokenStrategy` ([l.14](../../backend/src/auth/strategies/refresh-token.strategy.ts#L14)) — Stratégie passport de l'authentification (inscription, connexion, tokens, mot de passe).
- `constructor` ([l.22](../../backend/src/auth/strategies/refresh-token.strategy.ts#L22)) — Injecte les dépendances : AuthService.
- `validate` ([l.45](../../backend/src/auth/strategies/refresh-token.strategy.ts#L45)) — Vérifie que le refresh token du cookie est connu et non expiré, puis retourne l'utilisateur ; il devient req.user.
- `rawRefreshToken` ([l.48](../../backend/src/auth/strategies/refresh-token.strategy.ts#L48)) — Refresh token brut lu dans le cookie de la requête.

**[`backend/src/auth/utils/utils.ts`](../../backend/src/auth/utils/utils.ts)**

- `hashToken` ([l.3](../../backend/src/auth/utils/utils.ts#L3)) — Retourne le hash SHA-256 (hexadécimal) d'un jeton, pour ne jamais le stocker en clair.
- `hashRefreshToken` ([l.8](../../backend/src/auth/utils/utils.ts#L8)) — Retourne le hash SHA-256 (hexadécimal) d'un refresh token, pour ne jamais stocker le token en clair.

**[`backend/src/mail/mail.service.ts`](../../backend/src/mail/mail.service.ts)**

- `MailService` ([l.11](../../backend/src/mail/mail.service.ts#L11)) — Service métier des emails transactionnels.
- `constructor` ([l.17](../../backend/src/mail/mail.service.ts#L17)) — Crée le transport SMTP si SMTP_HOST est défini ; sinon les emails sont simplement écrits dans les logs (dev sans serveur mail).
- `send` ([l.32](../../backend/src/mail/mail.service.ts#L32)) — Envoie un email texte ; lève une ServiceUnavailableException si l'envoi échoue.
- `sendQuietly` ([l.56](../../backend/src/mail/mail.service.ts#L56)) — Comme send, mais n'échoue jamais : pour les emails de simple information (l'opération a déjà eu lieu).

**[`backend/src/users/dtos/list-friends-query.dto.ts`](../../backend/src/users/dtos/list-friends-query.dto.ts)**

- `ListFriendsQueryDto` ([l.5](../../backend/src/users/dtos/list-friends-query.dto.ts#L5)) — Paramètres validés de la liste d'amis (pagination, recherche, filtre en ligne).

**[`backend/src/users/dtos/search-users-query.dto.ts`](../../backend/src/users/dtos/search-users-query.dto.ts)**

- `SearchUsersQueryDto` ([l.4](../../backend/src/users/dtos/search-users-query.dto.ts#L4)) — Paramètres validés de la recherche d'utilisateurs.

**[`backend/src/users/dtos/update-profile.dto.ts`](../../backend/src/users/dtos/update-profile.dto.ts)**

- `UpdateProfileDto` ([l.3](../../backend/src/users/dtos/update-profile.dto.ts#L3)) — Corps validé de mise à jour du profil.

**[`backend/src/users/dtos/update-settings.dto.ts`](../../backend/src/users/dtos/update-settings.dto.ts)**

- `UpdateSettingsDto` ([l.11](../../backend/src/users/dtos/update-settings.dto.ts#L11)) — Corps validé des préférences (thème, langue, accent, arrondi).

**[`backend/src/users/entities/ranking-entry.entity.ts`](../../backend/src/users/entities/ranking-entry.entity.ts)**

- `RankingEntry` ([l.3](../../backend/src/users/entities/ranking-entry.entity.ts#L3)) — Ligne du classement (rang, joueur, note, matchs).

**[`backend/src/users/entities/refresh-token.entity.ts`](../../backend/src/users/entities/refresh-token.entity.ts)**

- `RefreshToken` ([l.3](../../backend/src/users/entities/refresh-token.entity.ts#L3)) — Refresh token stocké (haché) avec son expiration.
- `constructor` ([l.23](../../backend/src/users/entities/refresh-token.entity.ts#L23)) — Copie dans l'instance les champs fournis.

**[`backend/src/users/entities/user.entity.ts`](../../backend/src/users/entities/user.entity.ts)**

- `Role` ([l.5](../../backend/src/users/entities/user.entity.ts#L5)) — Rôles : ADMIN ou USER.
- `Status` ([l.11](../../backend/src/users/entities/user.entity.ts#L11)) — Statuts de présence : en ligne, hors ligne, en partie.
- `UserEntity` ([l.34](../../backend/src/users/entities/user.entity.ts#L34)) — Utilisateur exposé par l'API (champs sensibles exclus à la sérialisation).
- `constructor` ([l.96](../../backend/src/users/entities/user.entity.ts#L96)) — Copie dans l'instance les champs fournis.

**[`backend/src/users/interfaces/users.repository.ts`](../../backend/src/users/interfaces/users.repository.ts)**

- `IUsersRepository` ([l.3](../../backend/src/users/interfaces/users.repository.ts#L3)) — Contrat du dépôt des utilisateurs.

**[`backend/src/users/repositories/users.repository.ts`](../../backend/src/users/repositories/users.repository.ts)**

- `UserRepository` ([l.18](../../backend/src/users/repositories/users.repository.ts#L18)) — Dépôt de données des utilisateurs (profil, amis, classement) : requêtes Prisma et conversion en entités.
- `findUserById` ([l.24](../../backend/src/users/repositories/users.repository.ts#L24)) — Retrouve un utilisateur par id, avec ses refresh tokens, ou null.
- `findUserByEmail` ([l.38](../../backend/src/users/repositories/users.repository.ts#L38)) — Retrouve un utilisateur par email, avec ses refresh tokens, ou null.
- `findUserByLogin` ([l.51](../../backend/src/users/repositories/users.repository.ts#L51)) — Retrouve un utilisateur par login 42, avec ses refresh tokens, ou null.
- `createUserFrom42Profile` ([l.64](../../backend/src/users/repositories/users.repository.ts#L64)) — Crée un utilisateur à partir d'un profil 42 (login, email, nom complet, avatar).
- `createUserFromRegisterInfo` ([l.82](../../backend/src/users/repositories/users.repository.ts#L82)) — Crée un utilisateur à partir d'une inscription classique (email, nom, mot de passe haché).
- `updateUser` ([l.99](../../backend/src/users/repositories/users.repository.ts#L99)) — Met à jour les champs modifiables de l'utilisateur (2FA, présence, rôle, avatar, mot de passe, nom, email, préférences).
- `addRefreshToken` ([l.128](../../backend/src/users/repositories/users.repository.ts#L128)) — Insère un refresh token (hash + expiration) pour l'utilisateur.
- `deleteRefreshToken` ([l.143](../../backend/src/users/repositories/users.repository.ts#L143)) — Supprime un refresh token de l'utilisateur ; retourne true si au moins une ligne a été supprimée.
- `findRefreshToken` ([l.157](../../backend/src/users/repositories/users.repository.ts#L157)) — Retrouve un refresh token par son hash, uniquement s'il appartient à l'utilisateur, sinon null.
- `replacePasswordResetToken` ([l.176](../../backend/src/users/repositories/users.repository.ts#L176)) — Remplace le jeton de réinitialisation du mot de passe de l'utilisateur (un seul actif à la fois).
- `consumePasswordResetToken` ([l.190](../../backend/src/users/repositories/users.repository.ts#L190)) — Consomme un jeton de réinitialisation valide (usage unique) : change le mot de passe et révoque toutes les sessions.
- `mapUser` ([l.535](../../backend/src/users/repositories/users.repository.ts#L535)) — Convertit un utilisateur Prisma (avec refresh tokens) en UserEntity, en normalisant statut, rôle et préférences.

**[`backend/src/users/services/users.services.ts`](../../backend/src/users/services/users.services.ts)**

- `UsersService` ([l.32](../../backend/src/users/services/users.services.ts#L32)) — Service métier des utilisateurs (profil, amis, classement).
- `constructor` ([l.35](../../backend/src/users/services/users.services.ts#L35)) — Injecte les dépendances : UserRepository, PresenceGateway, NotificationsService.
- `findUserById` ([l.44](../../backend/src/users/services/users.services.ts#L44)) — Retrouve un utilisateur par id, ou null.
- `findUserByEmail` ([l.49](../../backend/src/users/services/users.services.ts#L49)) — Retrouve un utilisateur par email, ou null.
- `findUserByLogin` ([l.54](../../backend/src/users/services/users.services.ts#L54)) — Retrouve un utilisateur par login 42, ou null.
- `hidePresence` ([l.113](../../backend/src/users/services/users.services.ts#L113)) — Masque isOnline / status pour les non-amis.
- `createUserFrom42Profile` ([l.120](../../backend/src/users/services/users.services.ts#L120)) — Crée un utilisateur à partir du profil renvoyé par l'OAuth 42.
- `createUserFromRegisterInfo` ([l.125](../../backend/src/users/services/users.services.ts#L125)) — Crée un utilisateur avec mot de passe haché (bcrypt) ; lève une ConflictException si l'email est déjà pris.
- `updateUser` ([l.151](../../backend/src/users/services/users.services.ts#L151)) — Enregistre en base l'état complet de l'entité utilisateur.
- `updateProfile` ([l.156](../../backend/src/users/services/users.services.ts#L156)) — Met à jour le nom d'affichage (espaces retirés) de l'utilisateur.
- `updateSettings` ([l.165](../../backend/src/users/services/users.services.ts#L165)) — Met à jour le thème, la langue, la couleur principale et l'arrondi des bordures de l'utilisateur.
- `updateAvatar` ([l.177](../../backend/src/users/services/users.services.ts#L177)) — Enregistre le nouvel avatar et supprime l'ancien fichier s'il était stocké localement.
- `addRefreshToken` ([l.363](../../backend/src/users/services/users.services.ts#L363)) — Enregistre le hash d'un refresh token pour l'utilisateur, avec sa date d'expiration.
- `revokeRefreshToken` ([l.372](../../backend/src/users/services/users.services.ts#L372)) — Révoque (supprime) un refresh token ; retourne true s'il existait.
- `savePasswordResetToken` ([l.380](../../backend/src/users/services/users.services.ts#L380)) — Enregistre le hash du jeton de réinitialisation de mot de passe de l'utilisateur (remplace le précédent).
- `consumePasswordResetToken` ([l.393](../../backend/src/users/services/users.services.ts#L393)) — Consomme un jeton de réinitialisation (usage unique), change le mot de passe et révoque les sessions ; null si le jeton est invalide ou expiré.
- `findRefreshToken` ([l.425](../../backend/src/users/services/users.services.ts#L425)) — Retrouve un refresh token de l'utilisateur à partir de son hash, ou null.

**[`backend/src/users/users.controller.ts`](../../backend/src/users/users.controller.ts)**

- `UsersController` ([l.34](../../backend/src/users/users.controller.ts#L34)) — Contrôleur HTTP des utilisateurs (profil, amis, classement) : routes REST protégées par les guards d'authentification.
- `updateMe` ([l.117](../../backend/src/users/users.controller.ts#L117)) — PATCH /users/me : met à jour le profil (nom d'affichage) de l'utilisateur connecté.
- `updateSettings` ([l.126](../../backend/src/users/users.controller.ts#L126)) — PATCH /users/me/settings : met à jour les préférences (thème, langue).
- `uploadAvatar` ([l.135](../../backend/src/users/users.controller.ts#L135)) — POST /users/me/avatar : envoie l'avatar (JPEG/PNG/WebP, 2 Mo max), le stocke sur disque et met à jour le profil.

**[`backend/src/users/users.module.ts`](../../backend/src/users/users.module.ts)**

- `UsersModule` ([l.11](../../backend/src/users/users.module.ts#L11)) — Module NestJS des utilisateurs (profil, amis, classement) : regroupe contrôleur, services et dépendances.

### Frontend (React)

**[`frontend/src/features/auth/AuthBootstrap.tsx`](../../frontend/src/features/auth/AuthBootstrap.tsx)**

- `AuthBootstrap` ([l.13](../../frontend/src/features/auth/AuthBootstrap.tsx#L13)) — Au démarrage de l'app : tente un refresh de session (si un témoin existe) avant d'afficher quoi que ce soit, pour restaurer la connexion.

**[`frontend/src/features/auth/authApi.ts`](../../frontend/src/features/auth/authApi.ts)**

- `authApi` ([l.95](../../frontend/src/features/auth/authApi.ts#L95)) — Endpoints RTK Query du domaine « auth » (requêtes/mutations typées, cache et invalidation par tags) : REGISTER, LOGIN, REFRESH, LOGOUT, FORGOT_PASSWO…
- `onQueryStarted` ([l.107](../../frontend/src/features/auth/authApi.ts#L107)) — Après l'inscription : stocke l'access token reçu dans le store.
- `onQueryStarted` ([l.127](../../frontend/src/features/auth/authApi.ts#L127)) — Après le login : stocke l'access token, ou marque la 2FA comme requise (pré-authentification) si elle est activée.
- `onQueryStarted` ([l.148](../../frontend/src/features/auth/authApi.ts#L148)) — Après un refresh : remplace l'access token dans le store.
- `onQueryStarted` ([l.164](../../frontend/src/features/auth/authApi.ts#L164)) — Après la déconnexion : vide les identifiants et le cache API.

**[`frontend/src/features/auth/authSlice.ts`](../../frontend/src/features/auth/authSlice.ts)**

- `setAccessToken` ([l.20](../../frontend/src/features/auth/authSlice.ts#L20)) — Stocke l'access token (connexion, refresh, 2FA validée) et lève l'exigence de 2FA.
- `setTwoFactorRequired` ([l.25](../../frontend/src/features/auth/authSlice.ts#L25)) — Le login exige la 2FA : efface le token et active l'écran de code.
- `clearCredentials` ([l.30](../../frontend/src/features/auth/authSlice.ts#L30)) — Vide la session (déconnexion, ban, refresh refusé).
- `selectAccessToken` ([l.43](../../frontend/src/features/auth/authSlice.ts#L43)) — Sélecteur : access token courant (null si déconnecté).

**[`frontend/src/features/auth/login.schema.ts`](../../frontend/src/features/auth/login.schema.ts)**

- `createLoginSchema` ([l.4](../../frontend/src/features/auth/login.schema.ts#L4)) — Schéma zod du formulaire de connexion (email valide, mot de passe 8–32 caractères), messages traduits.

**[`frontend/src/features/auth/register.schema.ts`](../../frontend/src/features/auth/register.schema.ts)**

- `createRegisterSchema` ([l.4](../../frontend/src/features/auth/register.schema.ts#L4)) — Schéma zod du formulaire d'inscription (pseudo 3–32, email, mot de passe fort : minuscule, majuscule, chiffre, symbole).

**[`frontend/src/layouts/ProtectedLayout.tsx`](../../frontend/src/layouts/ProtectedLayout.tsx)**

- `ProtectedLayout` ([l.14](../../frontend/src/layouts/ProtectedLayout.tsx#L14)) — Garde des pages privées : sans access token, redirige vers /login ; sinon monte les bootstraps temps réel (réglages, présence, chat, tables, file, ma…

**[`frontend/src/lib/sessionHint.ts`](../../frontend/src/lib/sessionHint.ts)**

- `hasSessionHint` ([l.4](../../frontend/src/lib/sessionHint.ts#L4)) — 
- `setSessionHint` ([l.18](../../frontend/src/lib/sessionHint.ts#L18)) — Mémorise qu'une session existe (posé quand un access token apparaît).
- `clearSessionHint` ([l.27](../../frontend/src/lib/sessionHint.ts#L27)) — Oublie le témoin de session (déconnexion, ban, refresh refusé).

**[`frontend/src/lib/user.ts`](../../frontend/src/lib/user.ts)**

- `getInitials` ([l.1](../../frontend/src/lib/user.ts#L1)) — Initiales (2 lettres max) du nom pour l'avatar de repli, « FT » si le nom est vide.
- `resolveAvatarUrl` ([l.12](../../frontend/src/lib/user.ts#L12)) — Transforme l'URL d'avatar renvoyée par l'API (relative ou absolue) en URL complète utilisable dans une image.

**[`frontend/src/pages/ForgetPass.tsx`](../../frontend/src/pages/ForgetPass.tsx)**

- `ForgetPass` ([l.29](../../frontend/src/pages/ForgetPass.tsx#L29)) — Page « mot de passe oublié » : valide l'email puis demande l'envoi d'un lien de réinitialisation (réponse identique que le compte existe ou non).

**[`frontend/src/pages/Login.tsx`](../../frontend/src/pages/Login.tsx)**

- `LoginCredentialsForm` ([l.43](../../frontend/src/pages/Login.tsx#L43)) — Formulaire de connexion email / mot de passe (validation zod, erreurs serveur, bannières de ban) et bouton « se connecter avec 42 ».
- `Login` ([l.470](../../frontend/src/pages/Login.tsx#L470)) — Page de connexion : redirige si déjà connecté, sinon affiche le formulaire de credentials, le code 2FA ou le code de secours selon l'état.

**[`frontend/src/pages/ProfileMe.tsx`](../../frontend/src/pages/ProfileMe.tsx)**

- `ProfileMe` ([l.36](../../frontend/src/pages/ProfileMe.tsx#L36)) — Page « mon profil » : charge l'utilisateur connecté puis affiche son formulaire.
- `ProfileMeForm` ([l.47](../../frontend/src/pages/ProfileMe.tsx#L47)) — Formulaire du profil : modification du nom d'affichage, envoi de l'avatar (JPEG/PNG/WebP) et aperçu.

**[`frontend/src/pages/Register.tsx`](../../frontend/src/pages/Register.tsx)**

- `Register` ([l.29](../../frontend/src/pages/Register.tsx#L29)) — Page d'inscription : formulaire validé par zod (pseudo, email, mot de passe fort), puis connexion automatique.

**[`frontend/src/pages/ResetPassword.tsx`](../../frontend/src/pages/ResetPassword.tsx)**

- `ResetPassword` ([l.28](../../frontend/src/pages/ResetPassword.tsx#L28)) — Page de réinitialisation du mot de passe : lit le jeton dans l'URL, valide le nouveau mot de passe et l'envoie à l'API.

**[`frontend/src/pages/Settings.tsx`](../../frontend/src/pages/Settings.tsx)**

- `Settings` ([l.69](../../frontend/src/pages/Settings.tsx#L69)) — Page des réglages : thème, langue, couleur d'accent, arrondi, accès à la 2FA, export de données et demande de suppression du compte.

### Base de données

**[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)**

- `RefreshToken` ([l.199](../../backend/prisma/schema.prisma#L199)) — Refresh tokens stockés hachés, avec rotation.
- `PasswordResetToken` ([l.211](../../backend/prisma/schema.prisma#L211)) — Jetons de réinitialisation du mot de passe (hachés, à usage unique).
- `User` ([l.264](../../backend/prisma/schema.prisma#L264)) — Compte utilisateur : profil, avatar, rôle, préférences, Elo, XP, 2FA, OAuth 42.

**[`backend/prisma/seed.ts`](../../backend/prisma/seed.ts)**

- `daysAgo` ([l.29](../../backend/prisma/seed.ts#L29)) — Date située il y a `days` jours à l'heure donnée (minutes variables pour éviter des horaires identiques).
- `minutesAgo` ([l.36](../../backend/prisma/seed.ts#L36)) — Date située il y a `minutes` minutes.
- `idOf` ([l.75](../../backend/prisma/seed.ts#L75)) — Identifiant stable d'un compte de démo à partir de son slug.
- `emailOf` ([l.77](../../backend/prisma/seed.ts#L77)) — Adresse e-mail d'un compte de démo : prenom.nom@ft.local (l'admin garde admin@ft.local).
- `main` ([l.245](../../backend/prisma/seed.ts#L245)) — Reconstruit en une transaction les comptes de démo (utilisateurs, amis, conversations) et remet les deux tables de baby-foot à vide.
- `hashCode` ([l.364](../../backend/prisma/seed.ts#L364)) — Hash entier déterministe d'une chaîne, pour produire des valeurs pseudo-aléatoires reproductibles.

## Comment le démontrer

- S'inscrire, se déconnecter, se reconnecter ; changer le nom d'affichage et l'avatar ; recharger la page (session restaurée via refresh).
