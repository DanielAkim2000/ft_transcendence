# Système de notifications

**Type** : Minor (1 pt)  ·  **Sujet** : IV.1 Web — « A complete notification system for all creation, update, and deletion actions »  ·  **Tag dans le code** : `[Minor · Notifications]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Minor · Notifications] … */` : cherchez `[Minor · Notifications]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Notifications pour les créations, modifications et suppressions.

## Ce qui est implémenté

Chaque événement qui concerne un utilisateur (demande d'ami, défi, score, file d'attente, tournoi, invitation d'échecs…) crée une **notification persistée** (`Notification`), poussée en temps réel (`notifications:new`) et affichée en **toast** ; une page liste l'historique avec pastille de non-lus.

## Logique utilisée

1. **Backend** : `NotificationsService.create/createForUsers` écrit en base (le champ `data` contient déjà les noms résolus) puis `NotificationsGateway.emitToUser` prévient le client ; `countUnread` et `markAllRead` alimentent la pastille et le bouton « tout marquer comme lu ».
2. **Types** : l'enum `NotificationType` couvre amis, défis/scores, file d'attente, matchs de table, tournois et invitations d'échecs.
3. **Frontend** : `NotificationsBootstrap` invalide le cache à chaque `notifications:new` ; `notificationRender` traduit chaque type en texte, icône et lien ; en parallèle les bootstraps de domaine (matches, queue, tournaments, présence) affichent des **toasts** immédiats avec bouton d'action.

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/notifications/entities/notification.entity.ts`](../../backend/src/notifications/entities/notification.entity.ts)**

- `NotificationType` ([l.3](../../backend/src/notifications/entities/notification.entity.ts#L3)) — Types de notifications émises par l'application.
- `NotificationEntity` ([l.150](../../backend/src/notifications/entities/notification.entity.ts#L150)) — Notification d'un utilisateur (type, charge utile, lue ou non).
- `constructor` ([l.169](../../backend/src/notifications/entities/notification.entity.ts#L169)) — Copie dans l'instance les champs fournis.

**[`backend/src/notifications/notifications.controller.ts`](../../backend/src/notifications/notifications.controller.ts)**

- `NotificationsController` ([l.8](../../backend/src/notifications/notifications.controller.ts#L8)) — Contrôleur HTTP des notifications : routes REST protégées par les guards d'authentification.
- `list` ([l.15](../../backend/src/notifications/notifications.controller.ts#L15)) — GET /notifications?page=&limit= : page de l'historique des notifications de l'utilisateur connecté, les plus récentes d'abord.
- `countUnread` ([l.24](../../backend/src/notifications/notifications.controller.ts#L24)) — GET /notifications/unread-count : nombre de notifications non lues (pastille de la barre latérale).
- `markAllRead` ([l.30](../../backend/src/notifications/notifications.controller.ts#L30)) — POST /notifications/read-all : marque toutes les notifications de l'utilisateur connecté comme lues.

**[`backend/src/notifications/notifications.module.ts`](../../backend/src/notifications/notifications.module.ts)**

- `NotificationsModule` ([l.10](../../backend/src/notifications/notifications.module.ts#L10)) — Module NestJS des notifications : regroupe contrôleur, services et dépendances.

**[`backend/src/notifications/repositories/notifications.repository.ts`](../../backend/src/notifications/repositories/notifications.repository.ts)**

- `NotificationsRepository` ([l.13](../../backend/src/notifications/repositories/notifications.repository.ts#L13)) — Dépôt de données des notifications : requêtes Prisma et conversion en entités.
- `create` ([l.19](../../backend/src/notifications/repositories/notifications.repository.ts#L19)) — Crée une notification pour un utilisateur.
- `listPage` ([l.31](../../backend/src/notifications/repositories/notifications.repository.ts#L31)) — Liste une page des notifications d'un utilisateur, les plus récentes d'abord, plus le total.
- `countUnread` ([l.49](../../backend/src/notifications/repositories/notifications.repository.ts#L49)) — Nombre de notifications non lues de l'utilisateur.
- `markAllRead` ([l.54](../../backend/src/notifications/repositories/notifications.repository.ts#L54)) — Marque toutes les notifications de l'utilisateur comme lues.
- `toEntity` ([l.62](../../backend/src/notifications/repositories/notifications.repository.ts#L62)) — Convertit une ligne Prisma en NotificationEntity.

**[`backend/src/notifications/services/notifications.service.ts`](../../backend/src/notifications/services/notifications.service.ts)**

- `NotificationsService` ([l.12](../../backend/src/notifications/services/notifications.service.ts#L12)) — Service métier des notifications.
- `constructor` ([l.17](../../backend/src/notifications/services/notifications.service.ts#L17)) — Injecte les dépendances : NotificationsRepository, NotificationsGateway.
- `create` ([l.23](../../backend/src/notifications/services/notifications.service.ts#L23)) — Crée une notification pour un utilisateur et le prévient en temps réel (compteur de non-lus à jour).
- `createForUsers` ([l.42](../../backend/src/notifications/services/notifications.service.ts#L42)) — Même notification (payload identique) pour plusieurs destinataires.
- `listPage` ([l.51](../../backend/src/notifications/services/notifications.service.ts#L51)) — Liste une page des notifications de l'utilisateur, les plus récentes d'abord.
- `countUnread` ([l.61](../../backend/src/notifications/services/notifications.service.ts#L61)) — Nombre de notifications non lues (pastille de la barre latérale).
- `markAllRead` ([l.66](../../backend/src/notifications/services/notifications.service.ts#L66)) — Marque toutes les notifications de l'utilisateur comme lues.

### Frontend (React)

**[`frontend/src/features/matches/MatchesBootstrap.tsx`](../../frontend/src/features/matches/MatchesBootstrap.tsx)**

- `goToChallenges` ([l.25](../../frontend/src/features/matches/MatchesBootstrap.tsx#L25)) — Navigue vers la page des défis (action des toasts).
- `onProposed` ([l.28](../../frontend/src/features/matches/MatchesBootstrap.tsx#L28)) — Défi reçu : met à jour le cache et affiche un toast avec lien vers les défis.
- `onResponded` ([l.39](../../frontend/src/features/matches/MatchesBootstrap.tsx#L39)) — Réponse à un défi : met à jour le cache ; si refusé, prévient le challenger.
- `onScoreSubmitted` ([l.58](../../frontend/src/features/matches/MatchesBootstrap.tsx#L58)) — Score soumis par l'adversaire : prévient l'équipe qui doit le valider.
- `onCompleted` ([l.80](../../frontend/src/features/matches/MatchesBootstrap.tsx#L80)) — Match terminé : toast victoire ou défaite selon le score de l'utilisateur.
- `onCorrected` ([l.97](../../frontend/src/features/matches/MatchesBootstrap.tsx#L97)) — Score corrigé par un administrateur : toast d'information.
- `onDisputed` ([l.109](../../frontend/src/features/matches/MatchesBootstrap.tsx#L109)) — Score contesté : toast d'erreur.

**[`frontend/src/features/notifications/NotificationsBootstrap.tsx`](../../frontend/src/features/notifications/NotificationsBootstrap.tsx)**

- `NotificationsBootstrap` ([l.9](../../frontend/src/features/notifications/NotificationsBootstrap.tsx#L9)) — 
- `refresh` ([l.26](../../frontend/src/features/notifications/NotificationsBootstrap.tsx#L26)) — À chaque notification poussée par le serveur : invalide le cache des notifications et des parties d'échecs pour rafraîchir la pastille et les listes.

**[`frontend/src/features/notifications/notificationRender.ts`](../../frontend/src/features/notifications/notificationRender.ts)**

- `categoryOf` ([l.15](../../frontend/src/features/notifications/notificationRender.ts#L15)) — Icône et lien éventuel selon la famille de la notification.
- `renderNotification` ([l.31](../../frontend/src/features/notifications/notificationRender.ts#L31)) — Texte (traduit) et lien vers la page concernée pour une notification.

**[`frontend/src/features/notifications/notificationsApi.ts`](../../frontend/src/features/notifications/notificationsApi.ts)**

- `notificationsApi` ([l.45](../../frontend/src/features/notifications/notificationsApi.ts#L45)) — Endpoints RTK Query du domaine « notifications » (requêtes/mutations typées, cache et invalidation par tags) : LIST_NOTIFICATIONS, COUNT_UNREAD_NOTIF…

**[`frontend/src/features/presence/PresenceBootstrap.tsx`](../../frontend/src/features/presence/PresenceBootstrap.tsx)**

- `onFriendRequest` ([l.51](../../frontend/src/features/presence/PresenceBootstrap.tsx#L51)) — Demande d'ami reçue en direct : rafraîchit les listes et affiche un toast avec le nom de l'expéditeur.

**[`frontend/src/features/queue/QueueBootstrap.tsx`](../../frontend/src/features/queue/QueueBootstrap.tsx)**

- `onInvite` ([l.50](../../frontend/src/features/queue/QueueBootstrap.tsx#L50)) — Invitation à rejoindre un groupe reçue : toast avec lien vers les tables.
- `onInviteDeclined` ([l.61](../../frontend/src/features/queue/QueueBootstrap.tsx#L61)) — Un invité a refusé : toast d'erreur.
- `onGroupClosed` ([l.70](../../frontend/src/features/queue/QueueBootstrap.tsx#L70)) — Le groupe a été fermé : toast d'information.
- `onCalled` ([l.76](../../frontend/src/features/queue/QueueBootstrap.tsx#L76)) — C'est le tour du groupe de l'utilisateur : toast « table libre ».
- `onExpired` ([l.87](../../frontend/src/features/queue/QueueBootstrap.tsx#L87)) — Appel ou invitation expiré (délai, tournoi) : toast adapté à la raison.
- `onMatchStarted` ([l.102](../../frontend/src/features/queue/QueueBootstrap.tsx#L102)) — Match démarré sur une table : toast de confirmation.
- `onScoreRequired` ([l.114](../../frontend/src/features/queue/QueueBootstrap.tsx#L114)) — Le score doit être saisi : toast avec lien vers les tables.
- `onMatchEnded` ([l.124](../../frontend/src/features/queue/QueueBootstrap.tsx#L124)) — Match terminé : indique si le groupe reste ou quitte la table.
- `onMatchCancelled` ([l.134](../../frontend/src/features/queue/QueueBootstrap.tsx#L134)) — Match annulé (libération collective, admin…) : toast selon la raison.

**[`frontend/src/features/tournaments/TournamentsBootstrap.tsx`](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx)**

- `onLaunched` ([l.42](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx#L42)) — Tournoi lancé : cache + toast.
- `onTableReclaimed` ([l.52](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx#L52)) — Une table réservée au tournoi a été reprise : toast d'erreur.
- `onTieStarted` ([l.62](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx#L62)) — Un match de tournoi démarre pour l'utilisateur : toast avec lien vers les tables.
- `onTieWon` ([l.72](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx#L72)) — L'utilisateur a gagné sa confrontation : toast de succès.
- `onEliminated` ([l.78](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx#L78)) — L'utilisateur est éliminé : toast.
- `onCompleted` ([l.84](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx#L84)) — Tournoi terminé : cache + toast.

**[`frontend/src/pages/Notifications.tsx`](../../frontend/src/pages/Notifications.tsx)**

- `NotificationRow` ([l.18](../../frontend/src/pages/Notifications.tsx#L18)) — Ligne de notification : icône, texte traduit, date, pastille « non lue » et lien vers l'élément concerné.
- `Notifications` ([l.58](../../frontend/src/pages/Notifications.tsx#L58)) — Page des notifications : liste paginée et bouton « tout marquer comme lu ».

### Base de données

**[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)**

- `NotificationType` ([l.96](../../backend/prisma/schema.prisma#L96)) — Types de notifications.
- `Notification` ([l.582](../../backend/prisma/schema.prisma#L582)) — Notification persistée d'un utilisateur.

## Comment le démontrer

- Provoquer un défi ou une demande d'ami : toast instantané, puis entrée dans /notifications avec pastille de non-lu.
