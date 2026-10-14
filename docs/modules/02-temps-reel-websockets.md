# Temps réel (WebSockets)

**Type** : Major (2 pts)  ·  **Sujet** : IV.1 Web — « Implement real-time features using WebSockets or similar technology »  ·  **Tag dans le code** : `[Major · Temps réel WebSockets]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Major · Temps réel WebSockets] … */` : cherchez `[Major · Temps réel WebSockets]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Mises à jour en temps réel entre clients.
- Gestion propre des connexions/déconnexions.
- Diffusion efficace des messages.

## Ce qui est implémenté

Un **namespace Socket.IO par domaine** (`presence`, `chat`, `tables`, `queue`, `matches`, `tournaments`, `badges`, `notifications`, `chess`). Chaque connexion est authentifiée par l'access token et rejoint une *room* portant l'id de l'utilisateur : le serveur pousse les événements uniquement aux personnes concernées.

## Logique utilisée

1. **Authentification du socket** : le client envoie `auth.access_token` dans le handshake ; chaque `handleConnection` vérifie le JWT, charge l'utilisateur et fait `client.join(user.id)`. Sans token valide : `client.disconnect(true)`.
2. **Diffusion ciblée** : les services appellent `gateway.emitToUser(s)` (room par utilisateur) ou `emitToMatch`/`broadcast` ; exemple : `chess:state` n'est envoyé qu'aux deux joueurs de la partie.
3. **Présence** (`PresenceGateway`) : une table `onlineUsers` (userId → ensemble de sockets) gère le multi-onglets ; l'utilisateur passe OFFLINE seulement quand son dernier socket se ferme ; les amis reçoivent `presence:update`, et `presence:sync` donne l'état initial. `kickBannedUser` coupe les sockets d'un utilisateur banni.
4. **Côté client** : chaque domaine a un `*Socket.ts` (connect/disconnect, réutilisation du socket si le token n'a pas changé) et un `*Bootstrap.tsx` qui branche les événements sur le cache RTK Query et affiche des toasts. `closeSocket` (lib/socket.ts) évite de couper un WebSocket en pleine montée de polling.
5. **Reconnexion** : les bootstraps `tables`, `queue` et `tournaments` écoutent `socket.io.on('reconnect')` et invalident leur cache pour se resynchroniser après une coupure.

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/badges/badges.gateway.ts`](../../backend/src/badges/badges.gateway.ts)**

- `BadgesGateway` ([l.18](../../backend/src/badges/badges.gateway.ts#L18)) — Passerelle WebSocket des badges, de l'XP et des niveaux : namespace socket.io, authentification par access token et diffusion d'événements en temps r…
- `constructor` ([l.30](../../backend/src/badges/badges.gateway.ts#L30)) — Injecte les dépendances : UsersService, JwtService.
- `handleConnection` ([l.36](../../backend/src/badges/badges.gateway.ts#L36)) — Authentifie la connexion WebSocket via le JWT et fait rejoindre au client sa room personnelle (son userId) ; déconnecte si le token est absent ou inv…
- `emitToUser` ([l.61](../../backend/src/badges/badges.gateway.ts#L61)) — Envoie un événement (ex.

**[`backend/src/chat/chat.gateway.ts`](../../backend/src/chat/chat.gateway.ts)**

- `ChatGateway` ([l.24](../../backend/src/chat/chat.gateway.ts#L24)) — Passerelle WebSocket du chat (conversations, messages, blocages) : namespace socket.io, authentification par access token et diffusion d'événements e…
- `constructor` ([l.36](../../backend/src/chat/chat.gateway.ts#L36)) — Injecte les dépendances : UsersService, JwtService, ConversationRepository.
- `handleConnection` ([l.43](../../backend/src/chat/chat.gateway.ts#L43)) — Authentifie la connexion WebSocket via le JWT et fait rejoindre au client sa room personnelle (son userId) ; déconnecte si le token est absent ou inv…
- `emitNewMessage` ([l.68](../../backend/src/chat/chat.gateway.ts#L68)) — Envoie le nouveau message (message:new) aux deux participants de la conversation.

**[`backend/src/chess/chess.gateway.ts`](../../backend/src/chess/chess.gateway.ts)**

- `ChessGateway` ([l.29](../../backend/src/chess/chess.gateway.ts#L29)) — Passerelle WebSocket des parties d'échecs : namespace socket.io, authentification par access token et diffusion d'événements en temps réel.
- `constructor` ([l.40](../../backend/src/chess/chess.gateway.ts#L40)) — Injecte le service de jeu, le service utilisateurs (vérification du compte) et JwtService (vérification du token du socket).
- `handleConnection` ([l.47](../../backend/src/chess/chess.gateway.ts#L47)) — À la connexion d'un client : vérifie l'access token fourni dans le handshake socket.io, charge l'utilisateur et le fait rejoindre sa room personnelle…
- `handleResign` ([l.73](../../backend/src/chess/chess.gateway.ts#L73)) — Événement `chess:resign` : le joueur abandonne ; la partie terminée est diffusée aux deux joueurs (`chess:state`) ou une erreur traduisible (`chess:e…
- `handleMove` ([l.98](../../backend/src/chess/chess.gateway.ts#L98)) — Événement `chess:move` : valide et enregistre le coup via ChessService, diffuse le nouvel état aux deux joueurs en temps réel, puis fait répondre l'I…

**[`backend/src/matches/matches.gateway.ts`](../../backend/src/matches/matches.gateway.ts)**

- `MatchesGateway` ([l.19](../../backend/src/matches/matches.gateway.ts#L19)) — Passerelle WebSocket des matchs (défis, scores, Elo, historique) : namespace socket.io, authentification par access token et diffusion d'événements e…
- `constructor` ([l.31](../../backend/src/matches/matches.gateway.ts#L31)) — Injecte les dépendances : UsersService, JwtService.
- `handleConnection` ([l.37](../../backend/src/matches/matches.gateway.ts#L37)) — Authentifie la connexion WebSocket via le JWT et fait rejoindre au client sa room personnelle (son userId) ; déconnecte si le token est absent ou inv…
- `emitToUser` ([l.62](../../backend/src/matches/matches.gateway.ts#L62)) — Envoie un événement au seul utilisateur ciblé (via sa room personnelle).
- `emitToMatch` ([l.67](../../backend/src/matches/matches.gateway.ts#L67)) — Diffuse un événement à tous les participants (1 à 4 joueurs) du match.

**[`backend/src/notifications/notifications.gateway.ts`](../../backend/src/notifications/notifications.gateway.ts)**

- `NotificationsGateway` ([l.18](../../backend/src/notifications/notifications.gateway.ts#L18)) — Passerelle WebSocket des notifications : namespace socket.io, authentification par access token et diffusion d'événements en temps réel.
- `constructor` ([l.30](../../backend/src/notifications/notifications.gateway.ts#L30)) — Injecte les dépendances : UsersService, JwtService.
- `handleConnection` ([l.37](../../backend/src/notifications/notifications.gateway.ts#L37)) — Authentifie la connexion WebSocket via le JWT et fait rejoindre au client sa room personnelle (son userId) ; déconnecte si le token est absent ou inv…
- `emitToUser` ([l.62](../../backend/src/notifications/notifications.gateway.ts#L62)) — Envoie un événement (nouvelle notification, tout lu) au seul utilisateur ciblé.

**[`backend/src/presence/presence.gateway.ts`](../../backend/src/presence/presence.gateway.ts)**

- `PresenceGateway` ([l.20](../../backend/src/presence/presence.gateway.ts#L20)) — Passerelle WebSocket de la présence en ligne : namespace socket.io, authentification par access token et diffusion d'événements en temps réel.
- `constructor` ([l.34](../../backend/src/presence/presence.gateway.ts#L34)) — Injecte les dépendances : UsersService, JwtService.
- `handleConnection` ([l.41](../../backend/src/presence/presence.gateway.ts#L41)) — Authentifie la connexion WebSocket via le JWT, enregistre la session, envoie au client la présence de ses amis et passe l'utilisateur en ligne à sa p…
- `handleDisconnect` ([l.76](../../backend/src/presence/presence.gateway.ts#L76)) — Retire la session fermée ; quand la dernière session de l'utilisateur se ferme, il passe hors ligne.
- `notifyFriends` ([l.94](../../backend/src/presence/presence.gateway.ts#L94)) — Prévient tous les amis de l'utilisateur de son changement de statut (presence:update).
- `syncPresence` ([l.109](../../backend/src/presence/presence.gateway.ts#L109)) — Envoie au client la liste de ses amis actuellement en ligne (presence:sync).
- `emitToUser` ([l.126](../../backend/src/presence/presence.gateway.ts#L126)) — Envoie un événement à toutes les sessions ouvertes d'un utilisateur.
- `kickBannedUser` ([l.131](../../backend/src/presence/presence.gateway.ts#L131)) — Prévient un utilisateur qu'il vient d'être banni (auth:banned, avec motif et date de fin) puis ferme toutes ses sessions WebSocket : il passe hors li…
- `setUserPresence` ([l.140](../../backend/src/presence/presence.gateway.ts#L140)) — Enregistre le statut en ligne/hors ligne en base puis prévient les amis.

**[`backend/src/presence/presence.module.ts`](../../backend/src/presence/presence.module.ts)**

- `PresenceModule` ([l.6](../../backend/src/presence/presence.module.ts#L6)) — Module NestJS de la présence en ligne : regroupe contrôleur, services et dépendances.

**[`backend/src/queue/queue.gateway.ts`](../../backend/src/queue/queue.gateway.ts)**

- `QueueGateway` ([l.19](../../backend/src/queue/queue.gateway.ts#L19)) — Passerelle WebSocket de la file d'attente des tables : namespace socket.io, authentification par access token et diffusion d'événements en temps réel.
- `constructor` ([l.31](../../backend/src/queue/queue.gateway.ts#L31)) — Injecte les dépendances : UsersService, JwtService.
- `handleConnection` ([l.37](../../backend/src/queue/queue.gateway.ts#L37)) — Authentifie la connexion WebSocket via le JWT et fait rejoindre au client sa room personnelle (son userId) ; déconnecte si le token est invalide.
- `emitQueueUpdate` ([l.62](../../backend/src/queue/queue.gateway.ts#L62)) — Liste à jour pour tout le monde (page Tables/Queue).
- `emitToUser` ([l.67](../../backend/src/queue/queue.gateway.ts#L67)) — Notification personnelle (c'est ton tour / tu as perdu ta place).
- `emitToUsers` ([l.72](../../backend/src/queue/queue.gateway.ts#L72)) — Notification personnelle envoyée à plusieurs utilisateurs à la fois.

**[`backend/src/tables/tables.gateway.ts`](../../backend/src/tables/tables.gateway.ts)**

- `TablesGateway` ([l.19](../../backend/src/tables/tables.gateway.ts#L19)) — Passerelle WebSocket des tables de babyfoot : namespace socket.io, authentification par access token et diffusion d'événements en temps réel.
- `constructor` ([l.31](../../backend/src/tables/tables.gateway.ts#L31)) — Injecte les dépendances : UsersService, JwtService.
- `handleConnection` ([l.37](../../backend/src/tables/tables.gateway.ts#L37)) — Authentifie la connexion WebSocket via le JWT ; déconnecte le client si le token est absent, invalide ou si l'utilisateur n'existe pas.
- `emitTableRemoved` ([l.61](../../backend/src/tables/tables.gateway.ts#L61)) — Prévient tous les clients connectés qu'une table a été supprimée (événement table:removed).
- `emitTableUpdate` ([l.66](../../backend/src/tables/tables.gateway.ts#L66)) — Diffuse l'état à jour d'une table à tous les clients connectés (événement table:update).

**[`backend/src/tournaments/tournaments.gateway.ts`](../../backend/src/tournaments/tournaments.gateway.ts)**

- `TournamentsGateway` ([l.18](../../backend/src/tournaments/tournaments.gateway.ts#L18)) — Passerelle WebSocket des tournois : namespace socket.io, authentification par access token et diffusion d'événements en temps réel.
- `constructor` ([l.30](../../backend/src/tournaments/tournaments.gateway.ts#L30)) — Injecte les dépendances : UsersService, JwtService.
- `handleConnection` ([l.36](../../backend/src/tournaments/tournaments.gateway.ts#L36)) — Authentifie la connexion WebSocket via le JWT et fait rejoindre au client sa room personnelle (son userId) ; déconnecte si le token est absent ou inv…
- `broadcast` ([l.61](../../backend/src/tournaments/tournaments.gateway.ts#L61)) — Diffuse à tout le monde (liste des tournois, page publique).
- `emitToUser` ([l.66](../../backend/src/tournaments/tournaments.gateway.ts#L66)) — Envoie un événement au seul utilisateur ciblé.
- `emitToUsers` ([l.71](../../backend/src/tournaments/tournaments.gateway.ts#L71)) — Envoie un événement à plusieurs utilisateurs à la fois (leurs rooms personnelles).

**[`backend/src/users/repositories/users.repository.ts`](../../backend/src/users/repositories/users.repository.ts)**

- `updatePresence` ([l.523](../../backend/src/users/repositories/users.repository.ts#L523)) — Met à jour l'état de connexion et le statut de l'utilisateur.

**[`backend/src/users/services/users.services.ts`](../../backend/src/users/services/users.services.ts)**

- `updatePresence` ([l.433](../../backend/src/users/services/users.services.ts#L433)) — Met à jour l'état de connexion et le statut (en ligne, hors ligne, en jeu) de l'utilisateur.

### Frontend (React)

**[`frontend/src/features/badges/badgesSocket.ts`](../../frontend/src/features/badges/badgesSocket.ts)**

- `connect` ([l.6](../../frontend/src/features/badges/badgesSocket.ts#L6)) — Ouvre le socket du namespace /badges (réutilisé tel quel si le token n'a pas changé, sinon l'ancien est fermé).
- `disconnect` ([l.15](../../frontend/src/features/badges/badgesSocket.ts#L15)) — Ferme proprement le socket du namespace /badges et oublie la référence.

**[`frontend/src/features/chat/ChatBootstrap.tsx`](../../frontend/src/features/chat/ChatBootstrap.tsx)**

- `ChatBootstrap` ([l.14](../../frontend/src/features/chat/ChatBootstrap.tsx#L14)) — Connecte le socket du chat pour tout l'espace connecté et déconnecte à la déconnexion de l'utilisateur.
- `onNewMessage` ([l.27](../../frontend/src/features/chat/ChatBootstrap.tsx#L27)) — Message reçu en temps réel : met à jour le cache des conversations (non lus, dernier message) sauf si la conversation est ouverte.

**[`frontend/src/features/chat/chatSocket.ts`](../../frontend/src/features/chat/chatSocket.ts)**

- `connect` ([l.6](../../frontend/src/features/chat/chatSocket.ts#L6)) — Ouvre le socket du namespace /chat (réutilisé si le token est inchangé).
- `disconnect` ([l.15](../../frontend/src/features/chat/chatSocket.ts#L15)) — Ferme proprement le socket /chat.

**[`frontend/src/features/chess/chessSocket.ts`](../../frontend/src/features/chess/chessSocket.ts)**

- `connectChess` ([l.6](../../frontend/src/features/chess/chessSocket.ts#L6)) — Ouvre le socket du namespace /chess (réutilisé si le token est inchangé).
- `disconnectChess` ([l.15](../../frontend/src/features/chess/chessSocket.ts#L15)) — Ferme proprement le socket /chess.

**[`frontend/src/features/matches/MatchesBootstrap.tsx`](../../frontend/src/features/matches/MatchesBootstrap.tsx)**

- `MatchesBootstrap` ([l.13](../../frontend/src/features/matches/MatchesBootstrap.tsx#L13)) — Connecte le socket des matchs et affiche des toasts en temps réel à chaque événement (défi reçu, réponse, score, résultat, correction, contestation) …

**[`frontend/src/features/matches/matchesSocket.ts`](../../frontend/src/features/matches/matchesSocket.ts)**

- `connect` ([l.6](../../frontend/src/features/matches/matchesSocket.ts#L6)) — Ouvre le socket du namespace /matches (réutilisé tel quel si le token n'a pas changé, sinon l'ancien est fermé).
- `disconnect` ([l.15](../../frontend/src/features/matches/matchesSocket.ts#L15)) — Ferme proprement le socket du namespace /matches et oublie la référence.

**[`frontend/src/features/notifications/notificationsSocket.ts`](../../frontend/src/features/notifications/notificationsSocket.ts)**

- `connect` ([l.6](../../frontend/src/features/notifications/notificationsSocket.ts#L6)) — Ouvre le socket du namespace /notifications (réutilisé tel quel si le token n'a pas changé, sinon l'ancien est fermé).
- `disconnect` ([l.15](../../frontend/src/features/notifications/notificationsSocket.ts#L15)) — Ferme proprement le socket du namespace /notifications et oublie la référence.

**[`frontend/src/features/presence/PresenceBootstrap.tsx`](../../frontend/src/features/presence/PresenceBootstrap.tsx)**

- `PresenceBootstrap` ([l.19](../../frontend/src/features/presence/PresenceBootstrap.tsx#L19)) — Connecte le socket de présence (statut en ligne des amis, demandes d'ami en direct, ban en direct) et le déconnecte à la déconnexion.
- `onUpdate` ([l.31](../../frontend/src/features/presence/PresenceBootstrap.tsx#L31)) — Changement de statut d'un ami : met à jour les caches de listes.
- `invalidateFriends` ([l.44](../../frontend/src/features/presence/PresenceBootstrap.tsx#L44)) — Invalide les caches des amis et utilisateurs pour les recharger.

**[`frontend/src/features/presence/applyPresenceToCache.ts`](../../frontend/src/features/presence/applyPresenceToCache.ts)**

- `applyPresenceToCache` ([l.7](../../frontend/src/features/presence/applyPresenceToCache.ts#L7)) — Met à jour le statut en ligne d'un utilisateur dans tous les caches de listes d'amis et de recherche, sans refaire de requête.

**[`frontend/src/features/presence/presenceSocket.ts`](../../frontend/src/features/presence/presenceSocket.ts)**

- `connect` ([l.6](../../frontend/src/features/presence/presenceSocket.ts#L6)) — Ouvre le socket /presence (réutilisé si le token est inchangé).
- `disconnect` ([l.18](../../frontend/src/features/presence/presenceSocket.ts#L18)) — Ferme le socket /presence.
- `getSocket` ([l.25](../../frontend/src/features/presence/presenceSocket.ts#L25)) — Renvoie le socket /presence courant (null si déconnecté).

**[`frontend/src/features/queue/QueueBootstrap.tsx`](../../frontend/src/features/queue/QueueBootstrap.tsx)**

- `QueueBootstrap` ([l.23](../../frontend/src/features/queue/QueueBootstrap.tsx#L23)) — Connecte le socket de la file d'attente et transforme chaque événement serveur en mise à jour du cache et en toast (invitation, appel à la table, exp…
- `onUpdate` ([l.45](../../frontend/src/features/queue/QueueBootstrap.tsx#L45)) — Mise à jour de la file d'une table poussée par le serveur : applique les groupes dans le cache.
- `onReconnect` ([l.147](../../frontend/src/features/queue/QueueBootstrap.tsx#L147)) — Après une reconnexion du socket : resynchronise la file.

**[`frontend/src/features/queue/queueSocket.ts`](../../frontend/src/features/queue/queueSocket.ts)**

- `connect` ([l.6](../../frontend/src/features/queue/queueSocket.ts#L6)) — Ouvre le socket du namespace /queue (réutilisé tel quel si le token n'a pas changé, sinon l'ancien est fermé).
- `disconnect` ([l.15](../../frontend/src/features/queue/queueSocket.ts#L15)) — Ferme proprement le socket du namespace /queue et oublie la référence.

**[`frontend/src/features/tables/TablesBootstrap.tsx`](../../frontend/src/features/tables/TablesBootstrap.tsx)**

- `TablesBootstrap` ([l.12](../../frontend/src/features/tables/TablesBootstrap.tsx#L12)) — Connecte le socket des tables et garde la liste à jour en temps réel (mise à jour, suppression, resynchronisation après coupure).
- `onUpdate` ([l.23](../../frontend/src/features/tables/TablesBootstrap.tsx#L23)) — Table modifiée côté serveur : met à jour le cache.
- `onRemoved` ([l.25](../../frontend/src/features/tables/TablesBootstrap.tsx#L25)) — Table supprimée côté serveur : la retire du cache.
- `onReconnect` ([l.28](../../frontend/src/features/tables/TablesBootstrap.tsx#L28)) — Après une reconnexion : recharge l'état complet des tables.

**[`frontend/src/features/tables/tablesSocket.ts`](../../frontend/src/features/tables/tablesSocket.ts)**

- `connect` ([l.6](../../frontend/src/features/tables/tablesSocket.ts#L6)) — Ouvre le socket du namespace /tables (réutilisé tel quel si le token n'a pas changé, sinon l'ancien est fermé).
- `disconnect` ([l.15](../../frontend/src/features/tables/tablesSocket.ts#L15)) — Ferme proprement le socket du namespace /tables et oublie la référence.

**[`frontend/src/features/tournaments/TournamentsBootstrap.tsx`](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx)**

- `TournamentsBootstrap` ([l.23](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx#L23)) — Connecte le socket des tournois et affiche des toasts en direct (lancement, table reprise, match prêt, victoire, élimination, fin) en gardant le cach…
- `onSync` ([l.39](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx#L39)) — Tournoi créé ou modifié côté serveur : met à jour le cache.
- `onReconnect` ([l.94](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx#L94)) — Après une reconnexion : recharge les tournois.

**[`frontend/src/features/tournaments/tournamentsSocket.ts`](../../frontend/src/features/tournaments/tournamentsSocket.ts)**

- `connect` ([l.6](../../frontend/src/features/tournaments/tournamentsSocket.ts#L6)) — Ouvre le socket du namespace /tournaments (réutilisé tel quel si le token n'a pas changé, sinon l'ancien est fermé).
- `disconnect` ([l.15](../../frontend/src/features/tournaments/tournamentsSocket.ts#L15)) — Ferme proprement le socket du namespace /tournaments et oublie la référence.

**[`frontend/src/lib/socket.ts`](../../frontend/src/lib/socket.ts)**

- `createSocket` ([l.3](../../frontend/src/lib/socket.ts#L3)) — Ouvre un namespace socket.io, que l'API soit à la racine ou derrière un préfixe (ex.
- `closeSocket` ([l.13](../../frontend/src/lib/socket.ts#L13)) — 
- `finish` ([l.26](../../frontend/src/lib/socket.ts#L26)) — Ferme réellement le socket (une seule fois) une fois l'upgrade WebSocket terminé, la connexion fermée ou le délai écoulé.

**[`frontend/src/pages/Chess.tsx`](../../frontend/src/pages/Chess.tsx)**

- `onState` ([l.157](../../frontend/src/pages/Chess.tsx#L157)) — État de partie reçu en direct (`chess:state`) : met à jour plateau, tour, statut, résultat et coups, et efface la sélection.
- `onError` ([l.171](../../frontend/src/pages/Chess.tsx#L171)) — Erreur de coup reçue (`chess:error`) : toast traduit et annulation de la sélection.

### Base de données

**[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)**

- `Status` ([l.17](../../backend/prisma/schema.prisma#L17)) — Statut de présence (en ligne, hors ligne, en partie).

### Autres fichiers liés

- `frontend/nginx.conf.template` — Proxy `/api/socket.io/` avec en-têtes Upgrade pour les WebSockets en production.

## Comment le démontrer

- Ouvrir deux navigateurs : changer de statut, envoyer un message, jouer un coup d'échecs → l'autre écran se met à jour sans rechargement.
- Fermer un onglet : l'ami ne passe hors ligne que quand le dernier onglet est fermé.

## Points à connaître / limites

- La reconnexion automatique est assurée par Socket.IO ; seules tables/queue/tournois resynchronisent explicitement leur état (les échecs rechargent l'état via l'API au rechargement de la page).
