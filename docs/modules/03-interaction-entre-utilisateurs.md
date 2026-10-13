# Interaction entre utilisateurs (chat, profil, amis)

**Type** : Major (2 pts)  ·  **Sujet** : IV.1 Web — « Allow users to interact with other users »  ·  **Tag dans le code** : `[Major · Interaction entre utilisateurs]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Major · Interaction entre utilisateurs] … */` : cherchez `[Major · Interaction entre utilisateurs]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Un système de chat de base (envoyer/recevoir des messages).
- Un système de profils (voir les informations d'un utilisateur).
- Un système d'amis (ajouter/retirer, voir la liste).

## Ce qui est implémenté

Chat privé en temps réel entre amis, page de profil public, liste d'amis avec demandes reçues/envoyées et recherche d'utilisateurs.

## Logique utilisée

1. **Chat** : une conversation unique par paire d'utilisateurs (`findOrCreateConversation`, réservée aux amis). `sendMessage` enregistre le message puis `ChatGateway.emitNewMessage` le pousse aux deux participants ; `ChatBootstrap` met à jour le cache (dernier message, compteur de non lus) sauf si la conversation est déjà ouverte (`activeConversation`).
2. **Profil** : `GET /users/:id` renvoie le profil public + le statut d'amitié vis-à-vis du visiteur ; la présence n'est exposée qu'aux amis (`hidePresence`). La page `Profile` affiche infos, niveau/badges et les actions d'amitié.
3. **Amis** : `sendFriendRequest` (accepte automatiquement si l'autre avait déjà demandé), `acceptFriendRequest`, `removeFriendship`, listes paginées (amis, reçues, envoyées). Une demande d'ami déclenche un événement `friend:request` + une notification.

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/chat/chat.controller.ts`](../../backend/src/chat/chat.controller.ts)**

- `ChatController` ([l.20](../../backend/src/chat/chat.controller.ts#L20)) — Contrôleur HTTP du chat (conversations, messages, blocages) : routes REST protégées par les guards d'authentification.
- `createConversation` ([l.26](../../backend/src/chat/chat.controller.ts#L26)) — POST /chat/conversations : retrouve ou crée la conversation entre l'utilisateur connecté et un autre utilisateur (amis uniquement).
- `listConversations` ([l.42](../../backend/src/chat/chat.controller.ts#L42)) — GET /chat/conversations : liste les conversations de l'utilisateur avec dernier message et compteur de non-lus.
- `getMessages` ([l.102](../../backend/src/chat/chat.controller.ts#L102)) — GET /chat/conversations/:conversationId/messages : messages d'une conversation, paginés par curseur.
- `sendMessage` ([l.117](../../backend/src/chat/chat.controller.ts#L117)) — POST /chat/conversations/:conversationId/messages : envoie un message dans la conversation.

**[`backend/src/chat/chat.module.ts`](../../backend/src/chat/chat.module.ts)**

- `ChatModule` ([l.12](../../backend/src/chat/chat.module.ts#L12)) — Module NestJS du chat (conversations, messages, blocages) : regroupe contrôleur, services et dépendances.

**[`backend/src/chat/dtos/create-conversation.dto.ts`](../../backend/src/chat/dtos/create-conversation.dto.ts)**

- `CreateConversationDto` ([l.3](../../backend/src/chat/dtos/create-conversation.dto.ts#L3)) — Corps validé de création de conversation (interlocuteur).

**[`backend/src/chat/dtos/pagination.dto.ts`](../../backend/src/chat/dtos/pagination.dto.ts)**

- `PaginationDto` ([l.4](../../backend/src/chat/dtos/pagination.dto.ts#L4)) — Paramètres de pagination par curseur des messages.

**[`backend/src/chat/dtos/send-message.dto.ts`](../../backend/src/chat/dtos/send-message.dto.ts)**

- `SendMessageDto` ([l.4](../../backend/src/chat/dtos/send-message.dto.ts#L4)) — Corps validé d'un message (contenu non vide).

**[`backend/src/chat/entities/conversation.entity.ts`](../../backend/src/chat/entities/conversation.entity.ts)**

- `ConversationEntity` ([l.4](../../backend/src/chat/entities/conversation.entity.ts#L4)) — Conversation entre deux utilisateurs (dernier message, non lus, dernière lecture de l'interlocuteur).
- `constructor` ([l.49](../../backend/src/chat/entities/conversation.entity.ts#L49)) — Copie dans l'instance les champs fournis.

**[`backend/src/chat/entities/message.entity.ts`](../../backend/src/chat/entities/message.entity.ts)**

- `MessageEntity` ([l.3](../../backend/src/chat/entities/message.entity.ts#L3)) — Message d'une conversation.
- `constructor` ([l.38](../../backend/src/chat/entities/message.entity.ts#L38)) — Copie dans l'instance les champs fournis.

**[`backend/src/chat/repositories/conversation.repository.ts`](../../backend/src/chat/repositories/conversation.repository.ts)**

- `ConversationRepository` ([l.6](../../backend/src/chat/repositories/conversation.repository.ts#L6)) — Dépôt de données du chat (conversations, messages, blocages) : requêtes Prisma et conversion en entités.
- `findBetweenUsers` ([l.12](../../backend/src/chat/repositories/conversation.repository.ts#L12)) — Retrouve la conversation entre deux utilisateurs (ids triés pour être indépendant de l'ordre), ou null.
- `create` ([l.25](../../backend/src/chat/repositories/conversation.repository.ts#L25)) — Crée la conversation entre deux utilisateurs (ids triés).
- `findById` ([l.35](../../backend/src/chat/repositories/conversation.repository.ts#L35)) — Retrouve une conversation par son id, ou null.
- `listForUser` ([l.44](../../backend/src/chat/repositories/conversation.repository.ts#L44)) — Liste les conversations de l'utilisateur, la plus récente d'abord, avec le nombre de messages non lus et la date de dernière lecture de l'interlocute…
- `toEntity` ([l.93](../../backend/src/chat/repositories/conversation.repository.ts#L93)) — Convertit une conversation Prisma en ConversationEntity.

**[`backend/src/chat/repositories/message.repository.ts`](../../backend/src/chat/repositories/message.repository.ts)**

- `MessageRepository` ([l.6](../../backend/src/chat/repositories/message.repository.ts#L6)) — Dépôt de données du chat (conversations, messages, blocages) : requêtes Prisma et conversion en entités.
- `create` ([l.12](../../backend/src/chat/repositories/message.repository.ts#L12)) — Crée un message (éventuellement une invitation à une partie d'échecs) et met à jour la date de la conversation, dans une même transaction.
- `findByConversation` ([l.35](../../backend/src/chat/repositories/message.repository.ts#L35)) — Retourne les messages d'une conversation, du plus récent au plus ancien, limités à limit et paginés à partir d'un curseur (id du dernier message reçu…
- `findLastMessageByConversationIds` ([l.51](../../backend/src/chat/repositories/message.repository.ts#L51)) — Retourne le dernier message de chacune des conversations données.
- `toEntity` ([l.64](../../backend/src/chat/repositories/message.repository.ts#L64)) — Convertit un message Prisma en MessageEntity.

**[`backend/src/chat/services/chat.service.ts`](../../backend/src/chat/services/chat.service.ts)**

- `ChatService` ([l.20](../../backend/src/chat/services/chat.service.ts#L20)) — Service métier du chat (conversations, messages, blocages).
- `constructor` ([l.23](../../backend/src/chat/services/chat.service.ts#L23)) — Injecte les dépendances : ConversationRepository, BlockRepository, MessageRepository, UsersService, ChatGateway.
- `findOrCreateConversation` ([l.32](../../backend/src/chat/services/chat.service.ts#L32)) — Retourne la conversation entre deux utilisateurs ; en l'absence de conversation, ne la crée que s'ils sont amis et non bloqués.
- `getConversation` ([l.73](../../backend/src/chat/services/chat.service.ts#L73)) — Retrouve une conversation et vérifie que l'utilisateur en est participant (404 / 403 sinon).
- `listConversations` ([l.98](../../backend/src/chat/services/chat.service.ts#L98)) — Liste les conversations de l'utilisateur en y attachant leur dernier message.
- `sendMessage` ([l.200](../../backend/src/chat/services/chat.service.ts#L200)) — Envoie un message dans une conversation, à condition que les deux soient amis et non bloqués, puis le diffuse en temps réel.
- `getMessages` ([l.267](../../backend/src/chat/services/chat.service.ts#L267)) — Retourne une page de messages d'une conversation dont l'utilisateur est participant.

**[`backend/src/users/repositories/users.repository.ts`](../../backend/src/users/repositories/users.repository.ts)**

- `findFriendshipBetween` ([l.331](../../backend/src/users/repositories/users.repository.ts#L331)) — Retrouve la relation d'amitié entre deux utilisateurs, quel que soit celui qui a fait la demande.
- `createFriendRequest` ([l.343](../../backend/src/users/repositories/users.repository.ts#L343)) — Crée une demande d'ami au statut PENDING.
- `acceptFriendship` ([l.350](../../backend/src/users/repositories/users.repository.ts#L350)) — Passe une relation d'amitié au statut ACCEPTED.
- `deleteFriendship` ([l.358](../../backend/src/users/repositories/users.repository.ts#L358)) — Supprime une relation d'amitié ou une demande.
- `listAcceptedFriends` ([l.363](../../backend/src/users/repositories/users.repository.ts#L363)) — Liste les amis confirmés de l'utilisateur (l'autre partie de chaque amitié acceptée), en ligne d'abord puis par nom : une page plus le total.
- `listIncomingRequests` ([l.400](../../backend/src/users/repositories/users.repository.ts#L400)) — Liste les utilisateurs ayant envoyé une demande d'ami en attente à cet utilisateur, les plus récentes d'abord : une page plus le total.
- `listOutgoingRequests` ([l.422](../../backend/src/users/repositories/users.repository.ts#L422)) — Liste les utilisateurs auxquels cet utilisateur a envoyé une demande d'ami en attente, les plus récentes d'abord : une page plus le total.
- `listAcceptedFriendIds` ([l.444](../../backend/src/users/repositories/users.repository.ts#L444)) — Ids de tous les amis confirmés de l'utilisateur (sans pagination : usage interne, ex.

**[`backend/src/users/services/users.services.ts`](../../backend/src/users/services/users.services.ts)**

- `getProfile` ([l.59](../../backend/src/users/services/users.services.ts#L59)) — Retourne un utilisateur par id ou lève une NotFoundException.
- `getProfileForViewer` ([l.71](../../backend/src/users/services/users.services.ts#L71)) — Profil public : la presence n'est visible qu'aux amis (ou soi-même).
- `sendFriendRequest` ([l.189](../../backend/src/users/services/users.services.ts#L189)) — Envoie une demande d'ami et notifie le destinataire ; si l'autre avait déjà envoyé une demande, l'amitié est acceptée.
- `acceptFriendRequest` ([l.236](../../backend/src/users/services/users.services.ts#L236)) — Accepte la demande d'ami reçue d'un utilisateur et le notifie ; 404 si aucune demande en attente ne lui est adressée.
- `removeFriendship` ([l.262](../../backend/src/users/services/users.services.ts#L262)) — Supprime l'amitié ou la demande entre deux utilisateurs et notifie l'autre ; 404 si aucune relation n'existe.
- `removeFriendshipIfExists` ([l.283](../../backend/src/users/services/users.services.ts#L283)) — Supprime silencieusement la relation d'amitié entre deux utilisateurs si elle existe (utilisé au blocage).
- `listFriends` ([l.297](../../backend/src/users/services/users.services.ts#L297)) — Liste une page des amis confirmés de l'utilisateur (en ligne d'abord), avec filtres optionnels texte / en ligne.
- `listFriendIds` ([l.311](../../backend/src/users/services/users.services.ts#L311)) — Ids de tous les amis confirmés (sans pagination : usage interne, ex.
- `listPendingRequests` ([l.316](../../backend/src/users/services/users.services.ts#L316)) — Liste une page des demandes d'ami reçues par l'utilisateur et non encore acceptées.
- `listOutgoingRequests` ([l.328](../../backend/src/users/services/users.services.ts#L328)) — Liste une page des demandes d'ami envoyées par l'utilisateur et non encore acceptées.
- `getFriendshipStatus` ([l.340](../../backend/src/users/services/users.services.ts#L340)) — Retourne la relation entre deux utilisateurs : 'self', 'none', 'pending_out', 'pending_in' ou 'friends'.

**[`backend/src/users/users.controller.ts`](../../backend/src/users/users.controller.ts)**

- `listFriends` ([l.59](../../backend/src/users/users.controller.ts#L59)) — GET /users/me/friends?page=&limit=&q=&online= : page des amis de l'utilisateur connecté, en ligne d'abord.
- `listPending` ([l.71](../../backend/src/users/users.controller.ts#L71)) — GET /users/me/friends/pending?page=&limit= : page des demandes d'ami reçues, en attente de réponse.
- `listOutgoing` ([l.80](../../backend/src/users/users.controller.ts#L80)) — GET /users/me/friends/outgoing?page=&limit= : page des demandes d'ami envoyées, en attente de réponse.
- `sendFriendRequest` ([l.89](../../backend/src/users/users.controller.ts#L89)) — POST /users/me/friends/:userId : envoie une demande d'ami (ou accepte si l'autre en avait déjà envoyé une).
- `acceptFriendRequest` ([l.98](../../backend/src/users/users.controller.ts#L98)) — PATCH /users/me/friends/:userId/accept : accepte la demande d'ami reçue de cet utilisateur.
- `removeFriend` ([l.107](../../backend/src/users/users.controller.ts#L107)) — DELETE /users/me/friends/:userId : supprime l'amitié ou annule/refuse la demande.
- `getById` ([l.178](../../backend/src/users/users.controller.ts#L178)) — GET /users/:id : profil public d'un utilisateur avec le statut d'amitié vis-à-vis de l'utilisateur connecté.

### Frontend (React)

**[`frontend/src/features/chat/ChatThread.tsx`](../../frontend/src/features/chat/ChatThread.tsx)**

- `PeerAvatar` ([l.49](../../frontend/src/features/chat/ChatThread.tsx#L49)) — Avatar de l'interlocuteur chargé depuis son profil.
- `ChatThread` ([l.73](../../frontend/src/features/chat/ChatThread.tsx#L73)) — Fil de discussion d'une conversation.
- `submit` ([l.189](../../frontend/src/features/chat/ChatThread.tsx#L189)) — Envoie le message (trim, ignore le vide), signale la fin de saisie et efface le brouillon.

**[`frontend/src/features/chat/activeConversation.ts`](../../frontend/src/features/chat/activeConversation.ts)**

- `setActiveConversation` ([l.3](../../frontend/src/features/chat/activeConversation.ts#L3)) — Mémorise la conversation ouverte (pour ne pas compter ses messages comme non lus).
- `getActiveConversation` ([l.8](../../frontend/src/features/chat/activeConversation.ts#L8)) — Renvoie l'identifiant de la conversation actuellement ouverte.

**[`frontend/src/features/chat/chatApi.ts`](../../frontend/src/features/chat/chatApi.ts)**

- `chatApi` ([l.34](../../frontend/src/features/chat/chatApi.ts#L34)) — Endpoints RTK Query du domaine « chat » (requêtes/mutations typées, cache et invalidation par tags) : LIST_CONVERSATIONS, CREATE_CONVERSATION, GET_ME…
- `onQueryStarted` ([l.80](../../frontend/src/features/chat/chatApi.ts#L80)) — Après l'envoi : insère le message dans le cache sans attendre le socket.
- `applyMessageToCache` ([l.130](../../frontend/src/features/chat/chatApi.ts#L130)) — Insère un message (envoi ou websocket) dans les caches, sans doublon.

**[`frontend/src/features/chat/chatHelpers.ts`](../../frontend/src/features/chat/chatHelpers.ts)**

- `formatTime` ([l.3](../../frontend/src/features/chat/chatHelpers.ts#L3)) — Heure locale (HH:MM) d'un message.
- `otherUserId` ([l.7](../../frontend/src/features/chat/chatHelpers.ts#L7)) — Identifiant de l'autre participant d'une conversation.

**[`frontend/src/features/chat/messagePreview.ts`](../../frontend/src/features/chat/messagePreview.ts)**

- `messagePreview` ([l.5](../../frontend/src/features/chat/messagePreview.ts#L5)) — Texte court d'un message pour les aperçus (liste des conversations, accueil) : une invitation aux échecs est traduite au lieu d'afficher son texte te…

**[`frontend/src/features/users/FriendPicker.tsx`](../../frontend/src/features/users/FriendPicker.tsx)**

- `FriendPicker` ([l.18](../../frontend/src/features/users/FriendPicker.tsx#L18)) — Liste paginée (côté backend) d'amis à choisir, un seul à la fois.

**[`frontend/src/features/users/usersApi.ts`](../../frontend/src/features/users/usersApi.ts)**

- `usersApi` ([l.63](../../frontend/src/features/users/usersApi.ts#L63)) — Endpoints RTK Query du domaine « users » (requêtes/mutations typées, cache et invalidation par tags) : SEARCH_USERS, GET_RANKING, GET_USER, UPDATE_PR…

**[`frontend/src/pages/Chat.tsx`](../../frontend/src/pages/Chat.tsx)**

- `ConversationRow` ([l.19](../../frontend/src/pages/Chat.tsx#L19)) — Ligne de la liste des conversations : avatar et nom de l'interlocuteur, aperçu du dernier message, pastille de messages non lus.
- `Chat` ([l.89](../../frontend/src/pages/Chat.tsx#L89)) — Page de chat : liste des conversations à gauche, fil de discussion à droite ; ouvre ou crée la conversation demandée par `?user=`.

**[`frontend/src/pages/Friends.tsx`](../../frontend/src/pages/Friends.tsx)**

- `UserRow` ([l.25](../../frontend/src/pages/Friends.tsx#L25)) — Ligne d'un utilisateur (avatar, nom, présence pour les amis) avec ses boutons d'action.
- `Friends` ([l.91](../../frontend/src/pages/Friends.tsx#L91)) — Page des amis : amis (avec statut en ligne), demandes reçues et envoyées, et recherche d'utilisateurs pour en ajouter.
- `run` ([l.123](../../frontend/src/pages/Friends.tsx#L123)) — Exécute une action sur une amitié (ajout, acceptation, suppression) et affiche l'erreur éventuelle.

**[`frontend/src/pages/Profile.tsx`](../../frontend/src/pages/Profile.tsx)**

- `Profile` ([l.32](../../frontend/src/pages/Profile.tsx#L32)) — Profil public d'un joueur : infos, statut en ligne, carte de badges/niveau (PlayerBadgesCard) et actions d'amitié (envoyer, accepter, refuser, suppri…

### Base de données

**[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)**

- `FriendshipStatus` ([l.86](../../backend/prisma/schema.prisma#L86)) — États d'une relation d'amitié (en attente, acceptée).
- `Friendship` ([l.236](../../backend/prisma/schema.prisma#L236)) — Relation d'amitié entre deux utilisateurs.
- `Message` ([l.324](../../backend/prisma/schema.prisma#L324)) — Messages du chat (historique persisté).
- `Conversation` ([l.342](../../backend/prisma/schema.prisma#L342)) — Conversation entre deux utilisateurs, avec dernières lectures (accusés de lecture).

## Comment le démontrer

- Envoyer une demande d'ami, l'accepter depuis un autre compte, ouvrir le chat et échanger des messages.
- Visiter le profil d'un autre joueur.
