# Fonctionnalités avancées du chat

**Type** : Minor (1 pt)  ·  **Sujet** : IV.6 Gaming — « Advanced chat features »  ·  **Tag dans le code** : `[Minor · Chat avancé]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Minor · Chat avancé] … */` : cherchez `[Minor · Chat avancé]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Bloquer des utilisateurs.
- Inviter à jouer depuis le chat.
- Notifications de jeu dans le chat.
- Accès aux profils.
- Historique persistant.
- Indicateurs de saisie et accusés de lecture.

## Ce qui est implémenté

Sur le chat de base : **blocage**, **invitation à une partie d'échecs** (carte avec boutons accepter/refuser directement dans la conversation), **indicateur « est en train d'écrire »**, **accusés de lecture** (✓/✓✓), lien vers le profil et historique persisté avec chargement des anciens messages.

## Logique utilisée

1. **Blocage** : `blockUser/unblockUser`, `isBlockedByMe`, `listBlockedUsers` ; un blocage empêche l'envoi de messages et d'invitations dans les deux sens.
2. **Invitation** : `useChessInvite` crée la partie ; `ChessService.createGame` appelle `ChatService.postChessInvite`, qui poste un message portant `chessGameId` ; `ChessInviteCard` l'affiche comme carte interactive (accepter → ouvre la partie).
3. **Saisie** : le client émet `typing` (débouncé, `handleDraftChange`) ; `ChatGateway.handleTyping` le relaie à l'interlocuteur ; `typingIndicator.ts` diffuse l'événement aux composants.
4. **Lecture** : `markRead` enregistre l'horodatage de dernière lecture ; `conversation:read` est poussé en direct et `isReadByPeer` dérive le double check d'un message.
5. **Historique** : messages en base, chargés par curseur (`loadOlder`).

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/chat/chat.controller.ts`](../../backend/src/chat/chat.controller.ts)**

- `markRead` ([l.49](../../backend/src/chat/chat.controller.ts#L49)) — POST /chat/conversations/:conversationId/read : marque la conversation comme lue par l'utilisateur connecté.
- `listBlocked` ([l.60](../../backend/src/chat/chat.controller.ts#L60)) — GET /chat/blocks?page=&limit= : page des utilisateurs bloqués par l'utilisateur connecté.
- `isBlocked` ([l.70](../../backend/src/chat/chat.controller.ts#L70)) — GET /chat/blocks/:userId : indique si l'utilisateur connecté a bloqué cet utilisateur.
- `blockUser` ([l.80](../../backend/src/chat/chat.controller.ts#L80)) — POST /chat/blocks/:userId : bloque un utilisateur.
- `unblockUser` ([l.91](../../backend/src/chat/chat.controller.ts#L91)) — DELETE /chat/blocks/:userId : débloque un utilisateur.

**[`backend/src/chat/chat.gateway.ts`](../../backend/src/chat/chat.gateway.ts)**

- `emitConversationRead` ([l.75](../../backend/src/chat/chat.gateway.ts#L75)) — Prévient les deux participants (conversation:read) que l'un d'eux a lu la conversation.
- `handleTyping` ([l.90](../../backend/src/chat/chat.gateway.ts#L90)) — Relaye l'indicateur « en train d'écrire » aux deux participants, après avoir vérifié que l'émetteur fait partie de la conversation.

**[`backend/src/chat/entities/block.entity.ts`](../../backend/src/chat/entities/block.entity.ts)**

- `BlockEntity` ([l.3](../../backend/src/chat/entities/block.entity.ts#L3)) — Blocage d'un utilisateur par un autre (empêche les messages et les invitations).
- `constructor` ([l.21](../../backend/src/chat/entities/block.entity.ts#L21)) — Copie dans l'instance les champs fournis.

**[`backend/src/chat/repositories/block.repository.ts`](../../backend/src/chat/repositories/block.repository.ts)**

- `BlockRepository` ([l.10](../../backend/src/chat/repositories/block.repository.ts#L10)) — Dépôt des blocages : création, suppression, listes et test de blocage entre deux utilisateurs.
- `create` ([l.16](../../backend/src/chat/repositories/block.repository.ts#L16)) — Enregistre le blocage de blockedId par blockerId.
- `findBlock` ([l.25](../../backend/src/chat/repositories/block.repository.ts#L25)) — Retrouve le blocage exact de blockedId par blockerId (dans ce sens), ou null.
- `remove` ([l.36](../../backend/src/chat/repositories/block.repository.ts#L36)) — Supprime le blocage de blockedId par blockerId.
- `listBlockedByUser` ([l.43](../../backend/src/chat/repositories/block.repository.ts#L43)) — Liste une page des blocages émis par l'utilisateur (ceux qu'il a bloqués), les plus récents d'abord, plus le total.
- `listBlockingUser` ([l.61](../../backend/src/chat/repositories/block.repository.ts#L61)) — Liste les blocages reçus par l'utilisateur (ceux qui l'ont bloqué).
- `isBlocked` ([l.69](../../backend/src/chat/repositories/block.repository.ts#L69)) — Indique si l'un des deux utilisateurs a bloqué l'autre, dans un sens ou dans l'autre.
- `toEntity` ([l.83](../../backend/src/chat/repositories/block.repository.ts#L83)) — Convertit un blocage Prisma en BlockEntity.

**[`backend/src/chat/repositories/conversation.repository.ts`](../../backend/src/chat/repositories/conversation.repository.ts)**

- `markRead` ([l.81](../../backend/src/chat/repositories/conversation.repository.ts#L81)) — Met à jour la date de dernière lecture de l'utilisateur dans la conversation (côté A ou B selon sa position).

**[`backend/src/chat/services/chat.service.ts`](../../backend/src/chat/services/chat.service.ts)**

- `markConversationRead` ([l.119](../../backend/src/chat/services/chat.service.ts#L119)) — Marque la conversation comme lue par l'utilisateur et prévient l'autre participant en temps réel.
- `blockUser` ([l.133](../../backend/src/chat/services/chat.service.ts#L133)) — Bloque un utilisateur (pas soi-même, pas deux fois) et supprime l'amitié éventuelle entre les deux.
- `unblockUser` ([l.155](../../backend/src/chat/services/chat.service.ts#L155)) — Retire le blocage d'un utilisateur ; 404 s'il n'était pas bloqué.
- `listBlockedUsers` ([l.169](../../backend/src/chat/services/chat.service.ts#L169)) — Retourne les profils des utilisateurs bloqués par l'utilisateur.
- `isBlockedByMe` ([l.188](../../backend/src/chat/services/chat.service.ts#L188)) — Indique si l'utilisateur connecté a bloqué l'utilisateur ciblé.
- `postChessInvite` ([l.241](../../backend/src/chat/services/chat.service.ts#L241)) — Poste dans la conversation entre les deux joueurs un message d'invitation à la partie d'échecs donnée (affiché comme une carte côté client).

### Frontend (React)

**[`frontend/src/features/chat/ChatBootstrap.tsx`](../../frontend/src/features/chat/ChatBootstrap.tsx)**

- `onTyping` ([l.38](../../frontend/src/features/chat/ChatBootstrap.tsx#L38)) — Indicateur « est en train d'écrire » reçu en temps réel : le relaie aux composants abonnés.

**[`frontend/src/features/chat/ChatThread.tsx`](../../frontend/src/features/chat/ChatThread.tsx)**

- `isReadByPeer` ([l.43](../../frontend/src/features/chat/ChatThread.tsx#L43)) — Vrai si le message a été lu par l'interlocuteur (accusé de lecture : son dernier horodatage de lecture dépasse celui du message).
- `handleDraftChange` ([l.148](../../frontend/src/features/chat/ChatThread.tsx#L148)) — À chaque frappe : met à jour le brouillon, signale « écrit » à l'interlocuteur et programme le signal « a arrêté » après un court délai.
- `loadOlder` ([l.183](../../frontend/src/features/chat/ChatThread.tsx#L183)) — Charge les messages plus anciens (pagination par curseur) en conservant la position de défilement.
- `toggleBlock` ([l.208](../../frontend/src/features/chat/ChatThread.tsx#L208)) — Bloque ou débloque l'interlocuteur selon l'état courant et confirme par un toast.

**[`frontend/src/features/chat/chatApi.ts`](../../frontend/src/features/chat/chatApi.ts)**

- `onQueryStarted` ([l.91](../../frontend/src/features/chat/chatApi.ts#L91)) — Mise à jour optimiste : remet à zéro le compteur de non lus de la conversation marquée comme lue.
- `applyConversationReadToCache` ([l.174](../../frontend/src/features/chat/chatApi.ts#L174)) — Met à jour la date de dernière lecture du pair (double check en temps réel).

**[`frontend/src/features/chat/chatSocket.ts`](../../frontend/src/features/chat/chatSocket.ts)**

- `emitTyping` ([l.22](../../frontend/src/features/chat/chatSocket.ts#L22)) — Émet l'événement `typing` (l'utilisateur écrit / a arrêté) vers l'interlocuteur.

**[`frontend/src/features/chat/typingIndicator.ts`](../../frontend/src/features/chat/typingIndicator.ts)**

- `onTypingEvent` ([l.11](../../frontend/src/features/chat/typingIndicator.ts#L11)) — S'abonne aux événements « en train d'écrire » ; renvoie la fonction de désabonnement.
- `emitTypingEvent` ([l.17](../../frontend/src/features/chat/typingIndicator.ts#L17)) — Diffuse un événement « en train d'écrire » à tous les abonnés.

**[`frontend/src/features/chess/ChessInviteCard.tsx`](../../frontend/src/features/chess/ChessInviteCard.tsx)**

- `ChessInviteCard` ([l.23](../../frontend/src/features/chess/ChessInviteCard.tsx#L23)) — Carte affichée dans le chat à la place d'un message texte : invitation à une partie d'échecs, toujours à jour (en attente, acceptée, refusée, terminé…
- `openGame` ([l.31](../../frontend/src/features/chess/ChessInviteCard.tsx#L31)) — Ouvre la partie liée à l'invitation (/chess?gameId=…).
- `handleAccept` ([l.36](../../frontend/src/features/chess/ChessInviteCard.tsx#L36)) — Accepte l'invitation reçue dans le chat puis ouvre la partie.
- `handleDecline` ([l.49](../../frontend/src/features/chess/ChessInviteCard.tsx#L49)) — Refuse l'invitation reçue dans le chat.

**[`frontend/src/features/chess/useChessInvite.ts`](../../frontend/src/features/chess/useChessInvite.ts)**

- `useChessInvite` ([l.6](../../frontend/src/features/chess/useChessInvite.ts#L6)) — Invitation à une partie d'échecs depuis le chat ou un profil : crée le défi ; l'adversaire le reçoit dans le chat (entre amis) et dans ses notificati…
- `inviteToChess` ([l.11](../../frontend/src/features/chess/useChessInvite.ts#L11)) — Invite le joueur `peerId` ; affiche un toast de confirmation ou l'erreur (ex.

### Base de données

**[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)**

- `Block` ([l.360](../../backend/prisma/schema.prisma#L360)) — Blocage d'un utilisateur par un autre.

## Comment le démontrer

- Dans une conversation : écrire (indicateur chez l'autre), lire (double check), bloquer/débloquer, inviter aux échecs.
