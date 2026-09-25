# `demane` — Socle web (auth, utilisateurs, présence, chat, i18n/thème, infra, design system)

> Un fichier par membre de l'équipe dans `docs/team/`, chacun explique en profondeur — jusqu'au niveau du code — la partie qui lui revient. Les 5 fichiers mis bout à bout couvrent **tout** le projet, sans trou : [`rdinis.md`](./rdinis.md) (Tables & Queue), [`rbourdon.md`](./rbourdon.md) (Match & Elo), [`vicli.md`](./vicli.md) (Tournois), [`bbouarab.md`](./bbouarab.md) (Gamification). Vision produit et règles métier globales : [`../PLAN.md`](../PLAN.md).

Ce fichier couvre le **socle** : tout ce qui n'est pas une feature "babyfoot" en tant que telle mais sur lequel toutes les autres reposent — comptes, sécurité, présence, chat, préférences, et toute l'infrastructure qui fait tourner l'ensemble. C'est la partie la plus dense du projet ; prends le temps de la lire en entier, tu dois pouvoir répondre à n'importe quelle question dessus et aider n'importe quel mate bloqué sur sa slice si le blocage touche à l'auth, aux WebSockets ou à l'infra.

---

## 0. Vue d'ensemble du projet (contexte pour situer ta partie)

**Ce n'est pas un jeu de Pong.** ft_transcendence est une application web compagnon pour les **2 babyfoot physiques de 42 Paris** : voir si une table est libre, faire la queue, défier des joueurs depuis un classement Elo, organiser des tournois, débloquer des badges. Les modules "Gaming" du sujet (jeu web, remote, tournoi/spectateur du mini-jeu, IA, 3D...) ne sont **pas** claimés.

```
Navigateur (Chrome/Firefox/Safari)
        │  HTTPS (prod : 8443) / HTTP (dev : 5173)
        ▼
┌─────────────────────┐        WebSocket (un namespace par domaine)
│  React SPA (Vite)   │◄──────────────────────────────┐
│  Redux Toolkit +    │                                │
│  RTK Query          │  REST (/api en prod, direct     │
└─────────┬───────────┘  en dev)                        │
          │                                              │
          ▼                                              ▼
┌─────────────────────────────────────────────────────────┐
│  NestJS API — un module par domaine métier               │
│  (auth, users, presence, chat, tables, queue,             │
│   matches, tournaments, badges)                           │
└─────────────────────────┬─────────────────────────────────┘
                           │ Prisma ORM
                           ▼
                     PostgreSQL
```

Chaque domaine métier suit le même triptyque **Controller → Service → Repository**, plus un **Gateway WebSocket** dédié pour le temps réel, et côté frontend un triptyque équivalent **RTK Query API → Socket listener → Bootstrap component**. Une fois que tu as compris ce pattern ici, tu le reconnais dans les 4 autres fichiers.

### Modèle de données — vue d'ensemble complète

`backend/prisma/schema.prisma` (~365 lignes, PostgreSQL, client généré dans `backend/src/generated/prisma`) :

| Modèle | Rôle | Détaillé dans |
| --- | --- | --- |
| `User` | Compte central : identité, auth/2FA, présence, rôle, préférences, stats de classement | Ce fichier |
| `RefreshToken` | Un refresh token **haché** par ligne | Ce fichier, §1.5 |
| `Friendship` | Demande/relation d'amitié (`PENDING`/`ACCEPTED`) | Ce fichier, §2.2 |
| `Conversation`, `Message`, `Block` | Chat 1:1, non-lus, blocage | Ce fichier, §4 |
| `Table` | Une des 2 tables physiques | [`rdinis.md`](./rdinis.md) |
| `QueueEntry` | File d'attente d'une table | [`rdinis.md`](./rdinis.md) |
| `Match` | Défi/manche (1v1/2v2, score, validation) | [`rbourdon.md`](./rbourdon.md) |
| `Tournament`, `TournamentEntry`, `TournamentTie` | Tournoi, inscrits, rencontres | [`vicli.md`](./vicli.md) |
| `UserBadge` | Badges débloqués | [`bbouarab.md`](./bbouarab.md) |

**Enums** : `Role`, `Status`, `TableStatus`, `QueueEntryStatus`, `MatchFormat`, `MatchStatus`, `TournamentStatus`, `TournamentTieStatus`, `BadgeCode`, `FriendshipStatus`, `ThemePreference`, `LanguagePreference`.

Deux contraintes métier ne sont pas exprimables en DSL Prisma et vivent dans des migrations SQL écrites à la main (des index uniques **partiels**, `WHERE status IN (...)`) : un utilisateur ne peut occuper qu'une seule table à la fois (`20260922090000_table_one_per_user`), et n'avoir qu'une seule entrée de queue active à la fois (`20260922130000_add_queue`).

---

## 1. Authentification & comptes (`backend/src/auth/`)

C'est le module le plus dense du projet. Trois façons de s'authentifier, toutes convergent vers la **même paire de tokens JWT** (access + refresh).

### 1.1 Les 3 tokens et pourquoi il en faut 3

| Token | Durée (`.env`) | Où il vit | Rôle |
| --- | --- | --- | --- |
| **Access token** | `JWT_ACCESS_TOKEN_EXPIRATION_TIME` (défaut 1h) | En mémoire côté frontend (Redux), envoyé en `Authorization: Bearer` sur chaque requête et dans `handshake.auth.access_token` pour les WebSockets | Prouve l'identité pour les appels API/WS courants |
| **Refresh token** | `JWT_REFRESH_TOKEN_EXPIRATION_TIME` (défaut 7j) | Cookie **httpOnly** `refreshToken`, jamais lu par le JS frontend | Sert uniquement à obtenir un nouvel access token via `POST /auth/refresh`, sans redemander le mot de passe |
| **Pre-auth token** | `JWT_PRE_AUTH_TOKEN_EXPIRATION_TIME` (défaut 15 min) | Cookie **httpOnly** `preAuthToken` | Émis à la place des 2 tokens complets quand la 2FA est activée mais pas encore vérifiée — preuve "mot de passe correct" sans donner accès à l'API |

Chacun a son **propre secret** (`JWT_ACCESS_TOKEN_SECRET`, `JWT_REFRESH_TOKEN_SECRET`, `JWT_PRE_AUTH_TOKEN_SECRET`) et sa propre stratégie Passport (`backend/src/auth/strategies/`) — un token access ne peut donc jamais être utilisé comme refresh token même s'il tombait entre de mauvaises mains, et vice-versa.

**Point de sécurité important** : le refresh token n'est **jamais stocké en clair** en base. `hashRefreshToken()` (`backend/src/auth/utils/utils.ts`, SHA-256) le hache avant d'écrire `RefreshToken.tokenHash` :

```ts
// backend/src/auth/auth.service.ts — createTokens()
const expiresAt = new Date(Date.now() + ms(refreshTokenExpirationTime));
await this.usersService.addRefreshToken(user.id, hashRefreshToken(refreshToken), expiresAt);
```
Même une fuite complète de la base ne permet donc pas de rejouer un refresh token existant.

### 1.2 Email + mot de passe

```
POST /auth/register { email, username, password }  →  bcrypt.hash(password, 10), crée le user, émet les 2 tokens
POST /auth/login     { email, password }            →  bcrypt.compare(), puis :
   - twoFactorEnabled = false → émet les 2 tokens directement
   - twoFactorEnabled = true  → émet SEULEMENT un pre-auth token (cookie), renvoie { twoFactorEnabled: true }
```

### 1.3 OAuth2 42 intra

```
GET /auth/42/login    → AuthGuard('42') redirige vers profile.intra.42.fr
GET /auth/42/callback → Passport a déjà échangé le code contre un profil 42 (req.user rempli par FortyTwoStrategy)
```
```ts
// backend/src/auth/auth.service.ts
async validateUserFrom42Profile(_accessToken, _refreshToken, profile: Profile42Dto): Promise<UserEntity> {
  const existing = await this.usersService.findUserByLogin(profile._json.login);
  if (existing) return existing;
  return this.usersService.createUserFrom42Profile(profile); // 1er login 42 → création automatique du compte
}
```
Le callback redirige ensuite vers `${FRONTEND_URL}/auth/callback` (avec les tokens posés en cookies avant la redirection) — c'est cette page frontend qui termine la connexion côté client.

### 1.4 2FA TOTP — le détail qui compte : le flux en 2 temps

```ts
// backend/src/auth/auth.service.ts
async generate2faSecret(user): Promise<{ secret; otpauthUrl }> {
  const secret = generateSecret();
  const otpauthUrl = generateURI({ secret, label: user.email, issuer: 'ft_transcendence' });
  user.twoFactorPendingSecret = secret; // ← PAS encore actif
  await this.usersService.updateUser(user);
  return { secret, otpauthUrl };
}

async toggle2fa(user, code): Promise<boolean> {
  if (user.twoFactorEnabled) {
    await this.assertValidTotp(user.twoFactorSecret, code);
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorPendingSecret = null; // wipe complet à la désactivation
    return false;
  }
  if (!user.twoFactorPendingSecret) throw new BadRequestException('Generate a QR code before enabling...');
  await this.assertValidTotp(user.twoFactorPendingSecret, code);
  user.twoFactorEnabled = true;
  user.twoFactorSecret = user.twoFactorPendingSecret; // pending → actif SEULEMENT après un code valide
  user.twoFactorPendingSecret = null;
  return true;
}
```
**Pourquoi ce flux en 2 temps (`pending` puis actif) ?** Si on activait la 2FA dès le scan du QR code, un utilisateur qui scanne sans jamais confirmer avec un code se retrouverait avec une 2FA "à moitié configurée" — s'il perd son téléphone entre les deux, il est bloqué dehors sans même avoir "vraiment" activé quoi que ce soit. En exigeant un code TOTP valide pour faire passer `pending` → actif, on garantit que la 2FA n'est jamais activée sans que l'utilisateur ait prouvé qu'il sait générer un code valide.

`verify2fa()` (utilisé par `POST /auth/2fa/verify`, protégé par `PreAuthTokenGuard`) vérifie le code contre `twoFactorSecret` (le secret **actif**, pas le pending) et, si valide, appelle `createTokens()` pour terminer la connexion.

### 1.5 Rotation du refresh token

```ts
async rotateRefreshToken(user, oldRefreshToken): Promise<{accessToken; refreshToken}> {
  await this.assertRefreshTokenIsValid(user.id, oldRefreshToken); // existe en base ET pas expiré
  await this.revokeRefreshToken(user.id, oldRefreshToken);        // supprime l'ancien
  return this.createTokens(user);                                 // en émet un tout nouveau
}
```
Chaque appel à `POST /auth/refresh` **invalide l'ancien refresh token et en émet un nouveau** — si un refresh token volé était utilisé après que le vrai utilisateur a déjà rafraîchi, il serait rejeté.

### 1.6 Cookies — pourquoi `httpOnly`, `sameSite=lax`, `path=/auth`

```ts
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,                    // inaccessible au JS (protège contre le vol par XSS)
  secure: this.useSecureCookies(),   // true si HTTPS (prod) ou NODE_ENV=production
  sameSite: 'lax',                   // pas envoyé sur des requêtes cross-site tierces (protège contre le CSRF)
  path: '/auth',                     // n'est envoyé QUE sur les routes /auth/* (surface d'attaque réduite)
  maxAge: ms(expirationTime),
});
```
En production, nginx réécrit `path=/auth` en `path=/api/auth` côté navigateur (`proxy_cookie_path /auth /api/auth;`) puisque le navigateur ne parle qu'à `/api/...` (voir §6).

### 1.7 Guards & stratégies — la carte complète

| Guard | Stratégie Passport | Où la trouver | Utilisé par |
| --- | --- | --- | --- |
| `AccessTokenGuard` | `access-token` (JWT, secret access) | `guards/access-token.guard.ts` | Toutes les routes "normales" |
| `RefreshTokenGuard` | `refresh-token` (JWT, lu depuis le **cookie** `refreshToken`, pas le header) | `guards/refresh-token.guard.ts` | `/auth/refresh`, `/auth/logout` |
| `PreAuthTokenGuard` | `pre-auth-token` (JWT, cookie `preAuthToken` ou bearer) | `guards/pre-auth-token.guard.ts` | `/auth/2fa/verify`, `/auth/2fa/pending` |
| `RolesGuard` + `@AuthRoles(Role.ADMIN)` | (réutilise `AccessTokenGuard`) | `guards/roles.guard.ts` | `/auth/admin`, création/lancement de tournoi (voir [vicli.md](./vicli.md)) |

La stratégie refresh appelle en plus `authService.assertRefreshTokenIsValid()` **avant** de charger l'utilisateur — un JWT refresh syntaxiquement valide mais déjà révoqué (logout, rotation) est donc bien rejeté, pas seulement vérifié cryptographiquement.

### 1.8 Scénario complet : login avec 2FA activée

1. `POST /auth/login { email, password }` → mot de passe correct, `twoFactorEnabled: true` → réponse `{ twoFactorEnabled: true }` + cookie `preAuthToken` posé (15 min).
2. Le frontend affiche l'écran de saisie du code à 6 chiffres.
3. `POST /auth/2fa/verify { code }` (le cookie `preAuthToken` part automatiquement) → `PreAuthTokenGuard` décode le cookie, charge l'utilisateur → `verify2fa()` vérifie le TOTP → `createTokens()` émet access + refresh → cookie `preAuthToken` effacé, cookie `refreshToken` posé, `accessToken` renvoyé dans le corps (stocké en mémoire côté frontend).
4. 1h plus tard, l'access token expire : la prochaine requête API échoue en 401, le frontend appelle automatiquement `POST /auth/refresh` (cookie `refreshToken` envoyé automatiquement) → nouveau couple de tokens, la requête initiale est rejouée.

---

## 2. Utilisateurs, profil, amis (`backend/src/users/`)

### 2.1 Profil & avatar

`PATCH /users/me` (`{ displayname }`, 3-32 caractères). `POST /users/me/avatar` — `FileInterceptor('avatar')`, stockage disque dans `uploads/avatars/`, nom de fichier `${userId}-${Date.now()}.<ext>`, whitelist MIME `image/jpeg|png|webp`, taille max 2 Mo ; l'ancien avatar est **supprimé du disque** au remplacement (pas d'accumulation de fichiers orphelins).

### 2.2 Amis — machine à états

```
(aucune relation) ──sendFriendRequest──▶ PENDING ──acceptFriendRequest──▶ ACCEPTED
                                             │
                                       removeFriend / refus
                                             ▼
                                      (relation supprimée)
```
`Friendship` : `requesterId`, `addresseeId`, `status`, unique par paire. Point subtil dans `sendFriendRequest` : si une demande **inverse** existe déjà (B avait déjà demandé à A), on l'accepte directement au lieu de créer une 2e ligne en double — évite le cas "on s'est demandés en même temps". `removeFriend` fonctionne aussi bien pour annuler une demande en attente que pour rompre une amitié acceptée — une seule route `DELETE /users/me/friends/:userId` pour les deux cas.

### 2.3 Confidentialité de la présence

`GET /users?q=` (recherche) et `GET /users/:id` (profil public) **masquent** `isOnline`/`status` pour les utilisateurs qui ne sont pas amis (forcé à `false`/`OFFLINE` dans la réponse) — on ne peut pas espionner la présence de quelqu'un qu'on n'a pas ajouté.

### 2.4 Rôles

`Role.ADMIN`/`Role.USER` sur `User.role` (défaut `USER`). `RolesGuard` lit une métadonnée posée par `@Roles(...)`/`@AuthRoles(...)` et compare à `user.role`, sinon `ForbiddenException`. Utilisé pour les routes admin de tournoi (voir [vicli.md](./vicli.md)).

### 2.5 API récapitulative

| Route | Description |
| --- | --- |
| `GET /users?q=` | Recherche (masque la présence des non-amis) |
| `GET /users/ranking` | Top 100 par `rating` — voir [rbourdon.md](./rbourdon.md) |
| `GET /users/me/friends` \| `/pending` \| `/outgoing` | Listes d'amis / demandes reçues / demandes envoyées |
| `POST /users/me/friends/:userId` | Envoyer une demande (ou l'auto-accepter si l'inverse existe) |
| `PATCH /users/me/friends/:userId/accept` | Accepter |
| `DELETE /users/me/friends/:userId` | Retirer / refuser / annuler |
| `PATCH /users/me` | Modifier le displayname |
| `PATCH /users/me/settings` | Thème + langue (voir §5) |
| `POST /users/me/avatar` | Upload avatar |
| `GET /users/:id` | Profil public + `friendshipStatus` (`none`/`pending_out`/`pending_in`/`friends`/`self`) |

---

## 3. Présence en ligne (`backend/src/presence/`)

Gateway `/presence`. Le point technique clé : **gérer plusieurs onglets/connexions par utilisateur sans le faire clignoter offline/online**. Une `Map<userId, Set<socketId>>` **en mémoire** compte les connexions actives par utilisateur :

```ts
// backend/src/presence/presence.gateway.ts
async handleConnection(client): Promise<void> {
  const user = /* décodé depuis le JWT du handshake */;
  const wasOffline = !this.onlineUsers.has(user.id);
  if (!this.onlineUsers.has(user.id)) this.onlineUsers.set(user.id, new Set([client.id]));
  else this.onlineUsers.get(user.id)?.add(client.id);
  await client.join(user.id); // room nommée d'après l'userId, réutilisée par emitToUser()
  await this.syncPresence(client, user.id); // envoie l'état actuel des amis à CE nouvel onglet
  if (wasOffline) await this.setUserPresence(user.id, Status.ONLINE); // 1er onglet seulement → notifie les amis
}

async handleDisconnect(client): Promise<void> {
  const sockets = this.onlineUsers.get(client.data.userId);
  sockets?.delete(client.id);
  if (sockets && sockets.size > 0) return; // il reste au moins un autre onglet ouvert → rien à faire
  await this.setUserPresence(client.data.userId, Status.OFFLINE); // dernier onglet fermé → notifie les amis
}
```
Ouvrir un 2e onglet n'envoie donc **aucune** notification ; fermer un onglet tant qu'il en reste un autre ouvert non plus. Seuls le **premier** connect et le **dernier** disconnect déclenchent une écriture en base (`updatePresence`) et une notification aux amis (`presence:update`).

À la connexion, le client reçoit aussi un `presence:sync` avec l'état actuel de **tous** ses amis : `{ onlineFriends: [{userId, status: 'ONLINE'}] }`.

**Limite connue** : la `Map` est en mémoire, donc perdue si le serveur redémarre — tous les utilisateurs resteraient "en ligne" en base jusqu'à leur prochaine (dé)connexion. Pas un problème en pratique (les redémarrages en cours d'usage sont rares), mais une vraie limite à connaître si on te la pointe à la soutenance. Voir aussi [`../PRESENCE.md`](../PRESENCE.md) (doc de suivi plus ancienne, même contrat).

`emitToUser(userId, event, payload)` — helper générique réutilisé par le module **Users** pour pousser `friend:request`/`friend:update` (les amis n'ont pas leur propre gateway, ils empruntent celle de présence).

---

## 4. Chat (`backend/src/chat/`, `frontend/src/features/chat/`)

### 4.1 Conversations, blocage, non-lus

Conversations **1:1 entre amis uniquement**, vérifié à la création **et à chaque envoi** (si l'amitié est retirée entre-temps, l'envoi se bloque immédiatement). `Conversation.userALastReadAt`/`userBLastReadAt` servent à calculer le nombre de non-lus **sans table de lecture séparée** :
```ts
// backend/src/chat/repositories/conversation.repository.ts (listForUser)
this.prisma.message.count({
  where: { conversationId, senderId: { not: userId }, createdAt: { gt: /* mon propre lastReadAt */ } },
});
```
**Bloquer** quelqu'un (`POST /chat/blocks/:userId`) supprime aussi l'amitié automatiquement ; l'historique reste lisible dans les deux sens mais l'envoi est coupé.

### 4.2 Temps réel de base

Gateway `/chat` : `message:new` diffusé aux deux participants (`server.to([userAId, userBId]).emit(...)`) à chaque envoi.

### 4.3 Chat avancé (module bonus, +1 pt)

- **Accès au profil depuis le chat** — le nom/avatar en en-tête de conversation est un `<Link to={ROUTES.profile(peerId)}>`.
- **Indicateurs de frappe** — le client émet `typing { conversationId, isTyping }` sur chaque frappe, avec un **debounce de 1,5 s** avant d'envoyer `isTyping: false`. Le gateway vérifie que l'émetteur fait bien partie de la conversation puis relaie :
  ```ts
  @SubscribeMessage('typing')
  async handleTyping(client, payload: { conversationId; isTyping }) {
    const conversation = await this.conversationRepository.findById(payload.conversationId);
    if (!conversation || ![conversation.userAId, conversation.userBId].includes(client.data.userId)) return;
    this.server.to([conversation.userAId, conversation.userBId]).emit('typing', { conversationId, userId: client.data.userId, isTyping });
  }
  ```
  Côté récepteur, une expiration de secours à **3 s** cache l'indicateur même si le signal `isTyping: false` ne parvenait jamais.
- **Accusés de lecture** — `userALastReadAt`/`userBLastReadAt` existaient déjà pour le compteur de non-lus, mais n'étaient jamais renvoyés à l'**expéditeur**. `ChatService.markConversationRead()` (déclenché à l'ouverture d'une conversation) émet désormais un événement dédié :
  ```ts
  async markConversationRead(currentUserId, conversationId): Promise<void> {
    const conversation = await this.getConversation(currentUserId, conversationId);
    const readAt = new Date();
    await this.conversationRepository.markRead(conversationId, currentUserId);
    this.chatGateway.emitConversationRead(conversation, currentUserId, readAt); // → conversation:read
  }
  ```
  Le frontend expose un champ calculé `peerLastReadAt` sur chaque conversation et compare `message.createdAt <= conversation.peerLastReadAt` pour choisir entre une icône simple check (envoyé) ou double check (lu), mis à jour **en direct** sans rechargement.

---

## 5. i18n & thème

### 5.1 Langue

`i18next` avec 3 bundles JSON complets et strictement identiques en clés (`frontend/src/i18n/locales/{en,fr,es}.json`). La langue **vit dans Redux** (`settingsSlice`), pas directement dans `i18next` :
```
User.language (DB) → hydrateSettings (Redux, au login) → I18nSync.tsx (useEffect, i18n.changeLanguage) → i18next
```
`I18nSync.tsx` est le seul point qui appelle `i18n.changeLanguage()` — changer la langue ailleurs doit passer par `dispatch(setLanguage(...))`, jamais appeler i18next directement.

### 5.2 Thème

Même mécanisme exactement, avec `theme: 'light'|'dark'|'system'` :
```
User.theme (DB, défaut light) → hydrateSettings → ThemeSync.tsx → classe .dark sur <html>
```
`ThemeSync.tsx` résout `'system'` via `window.matchMedia('(prefers-color-scheme: dark)')` et écoute les changements OS tant que `theme === 'system'`.

### 5.3 Persistance

Une seule route pour les deux : `PATCH /users/me/settings { theme, language }` → `UsersService.updateSettings()` écrit les deux en une seule requête. Voir `pages/Settings.tsx`.

---

## 6. Design system

Palette, typographie, icônes et composants réutilisables — documentation dédiée dans [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md), résumé ici pour que ce fichier reste complet à lui seul :

- **Palette** : tokens CSS dans `frontend/src/index.css`, un jeu clair (`:root`) et un sombre (`.dark`), exposés à Tailwind via `@theme inline`. `--radius: 0` partout (esthétique "terminal", angles droits assumés).
- **Typographie** : une seule famille, **JetBrains Mono Variable**, appliquée à `--font-sans`/`--font-heading`/`--font-mono`/`--font-serif`.
- **Icônes** : `lucide-react` exclusivement.
- **16 composants réutilisables** (14 dans `components/ui/` + 2 composites) :

| Composant | Rôle |
| --- | --- |
| Button | 6 variantes × 8 tailles, `class-variance-authority` |
| Input, Label, Field | Champs de formulaire + validation |
| Card | Conteneur (header/title/description/content/footer) |
| Avatar | Image + initiales de repli |
| CodeInput | Saisie 2FA à 6 cases |
| RadioGroup | Choix unique accessible |
| Separator | Ligne de séparation |
| Sheet | Panneau latéral (drawer mobile) |
| Sidebar | Navigation latérale complète |
| Skeleton | Placeholder de chargement |
| Toast | Notifications éphémères |
| Tooltip | Infobulle |
| ConfirmDialog | Modale de confirmation générique |
| LegalLinks | Liens Privacy/Terms |

Tous **headless-first** (Base UI pour l'accessibilité/clavier/ARIA), stylés via les tokens ci-dessus avec `cn()` (`class-variance-authority` + `tailwind-merge`) — changer le thème ne touche jamais aux composants.

---

## 7. Infrastructure (Docker, HTTPS, secrets)

### 7.1 Développement vs production

| | `docker-compose.dev.yml` | `docker-compose.yml` |
| --- | --- | --- |
| Frontend | Vite dev server, port 5173, pas de build | nginx, sert le build React statique |
| Backend | `nest start --watch`, port 5000 exposé | `node dist/src/main`, **pas exposé** sur l'hôte |
| TLS | Aucun | nginx, certificat auto-signé |
| Usage | Itération avec hot reload | Démo / éval, une seule commande |

### 7.2 Services de `docker-compose.yml`

- **`db`** (Postgres 16) — mot de passe via **Docker secret** `postgres_password`, port hôte `${POSTGRES_PORT:-5433}`.
- **`backend`** — `NODE_ENV=production` fixe, `FRONTEND_URL`/`REDIRECT_URI` dérivés de `${PUBLIC_URL:-https://localhost:8443}` ; 5 secrets Docker ; **`expose` et pas `ports`** → uniquement joignable depuis nginx via le réseau Docker interne.
- **`frontend`** (conteneur nginx) — build arg `VITE_API_URL=${PUBLIC_URL}/api` (**baked in au build**), publie `${HTTPS_PORT:-8443}:443` et `${HTTP_PORT:-8080}:80`, monte le volume `tls_certs`.
- **Volumes nommés** : `postgres_data`, `backend_uploads`, `tls_certs`.

### 7.3 nginx — une seule origine publique

`frontend/nginx.conf.template` (variables injectées par `envsubst` au démarrage) :
- `/` → fichiers statiques du build React.
- `/api/*` → `backend:5000/*` (préfixe retiré).
- `/api/socket.io` → `backend:5000/socket.io`, en-têtes d'upgrade WebSocket, `proxy_read_timeout 1h`.
- Port 80 → redirection 301 vers HTTPS.
- `proxy_cookie_path /auth /api/auth;` — réécrit le `path` des cookies d'auth.

**Pourquoi une seule origine ?** Un seul certificat TLS, aucune configuration CORS nécessaire, cookies simples, WebSockets sans second certificat. Voir aussi [`../HTTPS.md`](../HTTPS.md).

### 7.4 Certificat auto-signé & secrets

`frontend/docker-entrypoint.d-generate-cert.sh` génère un certificat `CN=localhost` (SAN `localhost`/`127.0.0.1`, 365 jours) **seulement s'il n'existe pas déjà**, stocké dans le volume `tls_certs`. `./scripts/setup-docker.sh` génère les secrets dans `secrets/` (ignoré par git) : mot de passe DB, 3 secrets JWT, secret OAuth 42.

---

## 8. WebSockets — le pattern commun à toutes les gateways

```ts
async handleConnection(client): Promise<void> {
  const accessToken = client.handshake.auth.access_token;
  const decoded = await this.jwtService.verifyAsync<{userId: string}>(accessToken); // même secret que AccessTokenGuard
  const user = await this.usersService.findUserById(decoded.userId);
  client.data.userId = user.id;
  await client.join(user.id); // room nommée d'après l'userId
}
```
Rejoindre une room nommée d'après son propre `userId` permet à n'importe quel service de cibler un utilisateur précis avec `server.to(userId).emit(event, payload)`.

| Namespace | Événements principaux | Portée |
| --- | --- | --- |
| `/presence` | `presence:sync`, `presence:update` | Ciblé |
| `/chat` | `message:new`, `conversation:read`, `typing` | Aux 2 participants |
| `/tables` | `table:updated` | Broadcast à tout le monde (voir [rdinis.md](./rdinis.md)) |
| `/queue` | `queue:called`, `queue:expired` | Ciblé (voir [rdinis.md](./rdinis.md)) |
| `/matches` | `match:proposed/responded/scoreSubmitted/completed/disputed` | Ciblé (voir [rbourdon.md](./rbourdon.md)) |
| `/tournaments` | `created/updated` (broadcast), `launched/tableReclaimed/tieStarted/tieWon/eliminated/completed` (ciblés) | Mixte (voir [vicli.md](./vicli.md)) |
| `/badges` | `badges:earned` | Ciblé (voir [bbouarab.md](./bbouarab.md)) |

Les événements `friend:request`/`friend:update` transitent par le gateway de **présence** (pas de gateway dédié aux amis).

---

## 9. Glossaire

| Terme | Sens dans ce projet |
| --- | --- |
| **Race condition** | Deux requêtes concurrentes qui liraient/écriraient le même état sans coordination — évité par des `updateMany` avec conditions (voir [rdinis.md](./rdinis.md)). |
| **Room (Socket.IO)** | Un canal nommé auquel un ou plusieurs sockets sont abonnés — ici, une room par `userId`. |
| **Namespace (Socket.IO)** | Un sous-espace de connexion isolé (ex: `/chat`, `/tables`) — chaque domaine métier a le sien. |
| **Tie / Leg / Entry / Slot** | Vocabulaire du module Tournois — voir [vicli.md](./vicli.md) §3. |

## 10. FAQ générale / points de blocage classiques

- **"Le serveur redémarre, qu'est-ce qui est perdu ?"** → Tout ce qui vit en mémoire uniquement : la `Map` de présence (§3), les `setTimeout()` de la queue et de la validation de score (voir [rdinis.md](./rdinis.md)/[rbourdon.md](./rbourdon.md)). Tout le reste (Elo, badges, tournois, messages) est en base et survit.
- **"Comment ajouter une nouvelle feature qui suit le même pattern ?"** → Copier la structure d'un module existant : `entities/`, `repositories/`, `services/`, `<nom>.controller.ts`, `<nom>.gateway.ts`, `<nom>.module.ts`, l'enregistrer dans `app.module.ts`. Côté frontend : `features/<nom>/<nom>Api.ts`, `<nom>Socket.ts`, `<nom>Bootstrap.tsx`, monté dans `ProtectedLayout.tsx`.
- **"Comment débugger un problème de WebSocket ?"** → (1) le token du handshake est-il valide/non expiré ? (2) le client a-t-il rejoint la bonne room ? (3) le service émet-il vers la bonne room/le bon événement ? (4) le frontend écoute-t-il le bon événement sur le bon namespace ? Les logs NestJS affichent `[WebSocketsController] XxxGateway subscribed to the "yyy" message` au démarrage.
- **"Pourquoi autant de vérifications `updateMany` + count plutôt que de simples `update` ?"** → Protection anti-race-condition, expliquée en détail dans [rdinis.md](./rdinis.md) §5.1 (Tables) — le même principe est réutilisé dans la Queue et les Tournois.
- **"Où est testé tout ça ?"** → Pas de suite de tests automatisés livrée dans le dépôt à ce stade (scripts de vérification manuelle utilisés pendant le développement, non conservés). À dire honnêtement si la question vient en soutenance.
