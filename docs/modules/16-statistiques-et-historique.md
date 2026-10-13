# Statistiques de jeu et historique des matchs

**Type** : Minor (1 pt)  ·  **Sujet** : IV.3 User Management — « Game statistics and match history »  ·  **Tag dans le code** : `[Minor · Stats et historique]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Minor · Stats et historique] … */` : cherchez `[Minor · Stats et historique]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Statistiques (victoires, défaites, classement, niveau…).
- Historique des matchs (adversaires, dates, résultats).
- Progression/succès.
- Intégration au classement.

## Ce qui est implémenté

Classement **Elo** (par équipe en 1v1 et 2v2), historique détaillé des matchs (score, adversaires, format, origine ladder/tournoi, date), défis, statistiques par joueur (victoires, défaites, série, niveau) et historique des parties d'échecs terminées.

## Logique utilisée

1. **Cycle d'un match** : `propose` → `respond` (accepter/refuser, choix du coéquipier en 2v2) → `submitScore` par un joueur → `validateScore` par un adversaire (ou contestation) ; un score non validé dans le délai imparti passe automatiquement en litige (`scheduleValidationExpiry` → `handleValidationExpiry`).
2. **Elo** (`lib/elo.ts`) : probabilité attendue sur la moyenne des notes de chaque équipe, K = 40 pour les nouveaux joueurs (< 10 matchs) puis 20 ; `computeEloUpdates` produit les nouvelles notes, `applyEloUpdates` les enregistre avec les deltas du match en une transaction.
3. **Historique** : `GET /matches/me/history` (filtré/trié/paginé) rendu par `MatchHistoryList` ; `Ranking` affiche le classement avec podium ; `PlayerBadgesCard` montre statistiques et progression.
4. **Échecs** : `GET /chess/games/history` liste les parties terminées (résultat vu du joueur, raison de fin).

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/matches/dtos/propose-match.dto.ts`](../../backend/src/matches/dtos/propose-match.dto.ts)**

- `ProposeMatchDto` ([l.4](../../backend/src/matches/dtos/propose-match.dto.ts#L4)) — Corps validé d'un défi (adversaire, format, coéquipier).

**[`backend/src/matches/dtos/respond-match.dto.ts`](../../backend/src/matches/dtos/respond-match.dto.ts)**

- `RespondMatchDto` ([l.3](../../backend/src/matches/dtos/respond-match.dto.ts#L3)) — Corps validé de la réponse à un défi (accepter/refuser, coéquipier).

**[`backend/src/matches/dtos/submit-score.dto.ts`](../../backend/src/matches/dtos/submit-score.dto.ts)**

- `SubmitScoreDto` ([l.3](../../backend/src/matches/dtos/submit-score.dto.ts#L3)) — Corps validé d'une saisie de score (deux scores entiers).

**[`backend/src/matches/dtos/validate-score.dto.ts`](../../backend/src/matches/dtos/validate-score.dto.ts)**

- `ValidateScoreDto` ([l.3](../../backend/src/matches/dtos/validate-score.dto.ts#L3)) — Corps validé de la validation ou contestation d'un score.

**[`backend/src/matches/entities/match.entity.ts`](../../backend/src/matches/entities/match.entity.ts)**

- `MatchFormat` ([l.3](../../backend/src/matches/entities/match.entity.ts#L3)) — Formats de match : 1v1 ou 2v2.
- `MatchStatus` ([l.9](../../backend/src/matches/entities/match.entity.ts#L9)) — États du cycle de vie d'un match (proposé, accepté, score soumis, terminé, contesté…).
- `MatchPlayer` ([l.19](../../backend/src/matches/entities/match.entity.ts#L19)) — Joueur d'un match (id, nom, avatar, note Elo).
- `MatchEntity` ([l.31](../../backend/src/matches/entities/match.entity.ts#L31)) — Match avec ses équipes, scores, deltas Elo et infos de tournoi.
- `constructor` ([l.86](../../backend/src/matches/entities/match.entity.ts#L86)) — Copie dans l'instance les champs fournis.

**[`backend/src/matches/lib/elo.ts`](../../backend/src/matches/lib/elo.ts)**

- `EloPlayerInput` ([l.13](../../backend/src/matches/lib/elo.ts#L13)) — Entrée du calcul Elo : joueur, note, nombre de matchs.
- `EloPlayerResult` ([l.20](../../backend/src/matches/lib/elo.ts#L20)) — Résultat du calcul Elo : note avant/après d'un joueur.
- `kFactor` ([l.27](../../backend/src/matches/lib/elo.ts#L27)) — Retourne le facteur K d'Elo : 40 pour un joueur de moins de 10 matchs, 20 sinon.
- `expectedScore` ([l.34](../../backend/src/matches/lib/elo.ts#L34)) — Probabilité de victoire attendue (0 à 1) d'une équipe face à une autre, selon la formule Elo.
- `average` ([l.39](../../backend/src/matches/lib/elo.ts#L39)) — Moyenne des notes d'une équipe.
- `computeEloUpdates` ([l.46](../../backend/src/matches/lib/elo.ts#L46)) — outcomeForTeamA : 1 si l'équipe A a gagné, 0 si elle a perdu, 0.5 en cas d'égalité.
- `applyTeam` ([l.58](../../backend/src/matches/lib/elo.ts#L58)) — Calcule la nouvelle note de chaque joueur d'une équipe selon le résultat attendu et obtenu, avec son propre facteur K.

**[`backend/src/matches/matches.controller.ts`](../../backend/src/matches/matches.controller.ts)**

- `MatchesController` ([l.24](../../backend/src/matches/matches.controller.ts#L24)) — Contrôleur HTTP des matchs (défis, scores, Elo, historique) : routes REST protégées par les guards d'authentification.
- `listMine` ([l.31](../../backend/src/matches/matches.controller.ts#L31)) — GET /matches/me?page=&limit= : page des défis de ladder de l'utilisateur connecté (hors manches de tournoi et défis refusés).
- `listHistory` ([l.40](../../backend/src/matches/matches.controller.ts#L40)) — GET /matches/me/history?page=&limit=&q=&result=&format=&source=&sort= : page filtrée et triée de l'historique des matchs terminés de l'utilisateur (l…
- `countPendingActions` ([l.49](../../backend/src/matches/matches.controller.ts#L49)) — GET /matches/me/pending-actions : nombre de défis qui attendent une action de l'utilisateur.
- `getOne` ([l.55](../../backend/src/matches/matches.controller.ts#L55)) — GET /matches/:matchId : détail d'un match, réservé à ses participants.
- `propose` ([l.64](../../backend/src/matches/matches.controller.ts#L64)) — POST /matches : l'utilisateur connecté défie un adversaire (avec un coéquipier en 2v2).
- `respond` ([l.78](../../backend/src/matches/matches.controller.ts#L78)) — POST /matches/:matchId/respond : le joueur défié accepte ou refuse le défi.
- `submitScore` ([l.93](../../backend/src/matches/matches.controller.ts#L93)) — POST /matches/:matchId/score : un participant soumet le score, à valider par l'autre équipe.
- `validateScore` ([l.138](../../backend/src/matches/matches.controller.ts#L138)) — POST /matches/:matchId/validate : l'équipe adverse valide ou conteste le score soumis.

**[`backend/src/matches/matches.module.ts`](../../backend/src/matches/matches.module.ts)**

- `MatchesModule` ([l.14](../../backend/src/matches/matches.module.ts#L14)) — Module NestJS des matchs (défis, scores, Elo, historique) : regroupe contrôleur, services et dépendances.

**[`backend/src/matches/repositories/matches.repository.ts`](../../backend/src/matches/repositories/matches.repository.ts)**

- `involvesUser` ([l.52](../../backend/src/matches/repositories/matches.repository.ts#L52)) — Filtre Prisma : matchs où l'utilisateur est l'un des (jusqu'à 4) joueurs.
- `MatchesRepository` ([l.62](../../backend/src/matches/repositories/matches.repository.ts#L62)) — Dépôt de données des matchs (défis, scores, Elo, historique) : requêtes Prisma et conversion en entités.
- `create` ([l.68](../../backend/src/matches/repositories/matches.repository.ts#L68)) — Crée un match PENDING avec le challenger (et son coéquipier en 2v2) en équipe A et l'adversaire en équipe B.
- `findById` ([l.87](../../backend/src/matches/repositories/matches.repository.ts#L87)) — Retrouve un match par son id avec ses joueurs, ou null.
- `listForUser` ([l.96](../../backend/src/matches/repositories/matches.repository.ts#L96)) — Défis de la ladder (hors manches de tournoi, qui ont leur propre page) et hors défis refusés : une page, les plus récemment modifiés d'abord, plus le…
- `countActionableForUser` ([l.208](../../backend/src/matches/repositories/matches.repository.ts#L208)) — Nombre de défis de la ladder qui attendent une action de l'utilisateur : répondre à un défi reçu, jouer un match accepté, ou valider un score soumis …
- `decline` ([l.246](../../backend/src/matches/repositories/matches.repository.ts#L246)) — Atomique : seul le destinataire du défi peut le refuser, tant qu'il est en attente.
- `accept` ([l.255](../../backend/src/matches/repositories/matches.repository.ts#L255)) — Atomique : seul le destinataire peut accepter (et fournir son coéquipier en 2v2).
- `submitScore` ([l.272](../../backend/src/matches/repositories/matches.repository.ts#L272)) — Atomique : ne réussit que si le match est encore accepté (pas déjà soumis).
- `completeWithValidation` ([l.294](../../backend/src/matches/repositories/matches.repository.ts#L294)) — Atomique : ne réussit que si le score est encore en attente de validation.
- `completeByAdmin` ([l.303](../../backend/src/matches/repositories/matches.repository.ts#L303)) — Atomique : un administrateur saisit le score d'une manche de tournoi acceptée ; le match est terminé d'un coup (pas de validation par l'adversaire).
- `dispute` ([l.329](../../backend/src/matches/repositories/matches.repository.ts#L329)) — Atomique : litige, manuel ou après expiration du délai de validation.
- `getTeamsForElo` ([l.338](../../backend/src/matches/repositories/matches.repository.ts#L338)) — Notes + nb de matchs des 4 joueurs, pour le calcul Elo côté service.
- `notNull` ([l.355](../../backend/src/matches/repositories/matches.repository.ts#L355)) — Type guard : écarte les joueurs absents (null), par exemple l'équipier d'un 1v1.
- `applyEloUpdates` ([l.367](../../backend/src/matches/repositories/matches.repository.ts#L367)) — Applique les nouvelles notes Elo (utilisateurs + deltas du match) en une transaction ; matchesPlayed/xp restent gérés par BadgesService.
- `toEntity` ([l.392](../../backend/src/matches/repositories/matches.repository.ts#L392)) — Convertit une ligne Prisma en MatchEntity (équipes, scores, infos publiques des joueurs, infos de tournoi).
- `publicPlayer` ([l.394](../../backend/src/matches/repositories/matches.repository.ts#L394)) — Réduit un joueur Prisma à ses champs publics (id, nom, avatar, note), ou null.

**[`backend/src/matches/services/matches.service.ts`](../../backend/src/matches/services/matches.service.ts)**

- `MatchesService` ([l.33](../../backend/src/matches/services/matches.service.ts#L33)) — Service métier des matchs (défis, scores, Elo, historique).
- `constructor` ([l.39](../../backend/src/matches/services/matches.service.ts#L39)) — Injecte les dépendances : MatchesRepository, MatchesGateway, UsersService, TournamentsService, BadgesService, QueueService, NotificationsService.
- `listMine` ([l.50](../../backend/src/matches/services/matches.service.ts#L50)) — Liste une page des défis de ladder de l'utilisateur (hors manches de tournoi et défis refusés).
- `countActionable` ([l.74](../../backend/src/matches/services/matches.service.ts#L74)) — Nombre de défis en attente d'une action de l'utilisateur (pastille de la barre latérale).
- `getForUser` ([l.81](../../backend/src/matches/services/matches.service.ts#L81)) — Retourne un match si l'utilisateur en est participant, sinon lève une erreur 403/404.
- `propose` ([l.88](../../backend/src/matches/services/matches.service.ts#L88)) — Crée un défi (PENDING) : vérifie adversaire et coéquipier (obligatoire en 2v2), puis notifie l'adversaire en temps réel.
- `respond` ([l.142](../../backend/src/matches/services/matches.service.ts#L142)) — Traite la réponse du joueur défié : refus, ou acceptation (avec son coéquipier en 2v2) ; diffuse le match mis à jour aux participants.
- `submitScore` ([l.237](../../backend/src/matches/services/matches.service.ts#L237)) — Enregistre le score proposé par un participant, passe le match en attente de validation et arme le délai de validation.
- `assertValidScore` ([l.391](../../backend/src/matches/services/matches.service.ts#L391)) — Lève une BadRequestException si le score n'est pas valide (un camp à 10 points, l'autre en dessous).
- `isValidScore` ([l.402](../../backend/src/matches/services/matches.service.ts#L402)) — Vrai si l'un des deux camps a exactement 10 points et l'autre moins (jamais d'égalité).
- `validateScore` ([l.411](../../backend/src/matches/services/matches.service.ts#L411)) — Permet à l'équipe adverse de valider (match terminé, Elo/tournoi mis à jour) ou de contester (litige) le score soumis.
- `notifyCompleted` ([l.471](../../backend/src/matches/services/matches.service.ts#L471)) — Notifie chaque participant du résultat final, victoire ou défaite selon son propre camp.
- `notifyDisputed` ([l.492](../../backend/src/matches/services/matches.service.ts#L492)) — Notifie tous les participants du litige (score contesté ou jamais validé à temps).
- `applyElo` ([l.501](../../backend/src/matches/services/matches.service.ts#L501)) — Calcule et applique les nouvelles notes Elo des joueurs, puis enregistre le résultat (victoire, défaite ou nul) pour les badges et l'XP.
- `average` ([l.521](../../backend/src/matches/services/matches.service.ts#L521)) — Moyenne des notes d'un groupe de joueurs.
- `teamOf` ([l.538](../../backend/src/matches/services/matches.service.ts#L538)) — Retourne 'A' ou 'B' selon l'équipe de l'utilisateur dans le match, ou null s'il n'y participe pas.
- `assertParticipant` ([l.545](../../backend/src/matches/services/matches.service.ts#L545)) — Lève une ForbiddenException si l'utilisateur ne fait pas partie du match.
- `getMatch` ([l.555](../../backend/src/matches/services/matches.service.ts#L555)) — Retrouve un match par id ou lève une NotFoundException.
- `scheduleValidationExpiry` ([l.567](../../backend/src/matches/services/matches.service.ts#L567)) — Programme le passage automatique en litige si le score n'est pas validé dans SCORE_VALIDATION_TIMEOUT_MS.
- `handleValidationExpiry` ([l.576](../../backend/src/matches/services/matches.service.ts#L576)) — À l'expiration du délai, met le match en litige s'il attend toujours une validation, notifie les joueurs et prévient le tournoi le cas échéant.
- `clearTimer` ([l.590](../../backend/src/matches/services/matches.service.ts#L590)) — Annule et oublie le minuteur de validation d'un match, s'il existe.

**[`backend/src/users/entities/ranking-entry.entity.ts`](../../backend/src/users/entities/ranking-entry.entity.ts)**

- `constructor` ([l.21](../../backend/src/users/entities/ranking-entry.entity.ts#L21)) — Copie dans l'instance les champs fournis.

**[`backend/src/users/services/users.services.ts`](../../backend/src/users/services/users.services.ts)**

- `getRanking` ([l.442](../../backend/src/users/services/users.services.ts#L442)) — Retourne une page du classement des joueurs par note Elo, avec recherche, filtres et tri.

### Frontend (React)

**[`frontend/src/features/matches/ChallengeDialog.tsx`](../../frontend/src/features/matches/ChallengeDialog.tsx)**

- `ChallengeDialog` ([l.20](../../frontend/src/features/matches/ChallengeDialog.tsx#L20)) — Bouton + dialogue pour défier un joueur au babyfoot (1v1 ou 2v2) : utilisé depuis le classement et depuis le chat.
- `submit` ([l.34](../../frontend/src/features/matches/ChallengeDialog.tsx#L34)) — Envoie le défi (1v1 ou 2v2 avec coéquipier) à l'adversaire, ferme la boîte et confirme par un toast.

**[`frontend/src/features/matches/MatchCard.tsx`](../../frontend/src/features/matches/MatchCard.tsx)**

- `TeamNames` ([l.25](../../frontend/src/features/matches/MatchCard.tsx#L25)) — Affiche les joueurs d'une équipe (avatar + nom).
- `AcceptTwoVTwoDialog` ([l.39](../../frontend/src/features/matches/MatchCard.tsx#L39)) — Boîte de dialogue pour accepter un défi 2v2 : choix du coéquipier avant d'accepter.
- `submit` ([l.53](../../frontend/src/features/matches/MatchCard.tsx#L53)) — Accepte le défi 2v2 avec le coéquipier choisi puis ferme la boîte.
- `MatchCard` ([l.113](../../frontend/src/features/matches/MatchCard.tsx#L113)) — Carte d'un match selon son statut : proposé (accepter/refuser), accepté (saisir le score), score en attente de validation (valider/contester), termin…
- `run` ([l.127](../../frontend/src/features/matches/MatchCard.tsx#L127)) — Exécute une action sur le match, affiche un toast de succès ou l'erreur.
- `decline` ([l.143](../../frontend/src/features/matches/MatchCard.tsx#L143)) — Refuse le défi.
- `acceptSolo` ([l.146](../../frontend/src/features/matches/MatchCard.tsx#L146)) — Accepte le défi en 1v1.
- `submit` ([l.162](../../frontend/src/features/matches/MatchCard.tsx#L162)) — Envoie le score saisi (si valide) à l'adversaire pour validation.
- `TeamAvatar` ([l.356](../../frontend/src/features/matches/MatchCard.tsx#L356)) — Petit avatar d'un joueur (image ou initiales).

**[`frontend/src/features/matches/MatchHistoryList.tsx`](../../frontend/src/features/matches/MatchHistoryList.tsx)**

- `HistoryRow` ([l.106](../../frontend/src/features/matches/MatchHistoryList.tsx#L106)) — Ligne de l'historique : victoire/défaite, adversaires, score, format, origine (ladder/tournoi) et date.
- `names` ([l.116](../../frontend/src/features/matches/MatchHistoryList.tsx#L116)) — Noms d'une équipe joints par « & ».

**[`frontend/src/features/matches/matchHelpers.ts`](../../frontend/src/features/matches/matchHelpers.ts)**

- `teamOf` ([l.3](../../frontend/src/features/matches/matchHelpers.ts#L3)) — Équipe (A ou B) d'un utilisateur dans un match, null s'il n'y participe pas.

**[`frontend/src/features/matches/matchesApi.ts`](../../frontend/src/features/matches/matchesApi.ts)**

- `matchesApi` ([l.54](../../frontend/src/features/matches/matchesApi.ts#L54)) — Endpoints RTK Query du domaine « matches » (requêtes/mutations typées, cache et invalidation par tags) : LIST_MATCHES, LIST_MATCH_HISTORY, COUNT_MATC…
- `applyMatchToCache` ([l.147](../../frontend/src/features/matches/matchesApi.ts#L147)) — Un match a changé (websocket) : les listes sont paginées côté backend, on les recharge au lieu de les patcher.

**[`frontend/src/features/users/RankTrophy.tsx`](../../frontend/src/features/users/RankTrophy.tsx)**

- `RankTrophy` ([l.12](../../frontend/src/features/users/RankTrophy.tsx#L12)) — Coupe du podium : or (1er), argent (2e), bronze (3e).

**[`frontend/src/features/users/podium.ts`](../../frontend/src/features/users/podium.ts)**

- `isPodium` ([l.1](../../frontend/src/features/users/podium.ts#L1)) — Un rang du podium (1, 2 ou 3) : il faut avoir joué au moins un match pour l'avoir mérité (sinon tous les nouveaux à 1000 seraient « champions »).

**[`frontend/src/pages/Challenges.tsx`](../../frontend/src/pages/Challenges.tsx)**

- `Challenges` ([l.14](../../frontend/src/pages/Challenges.tsx#L14)) — Défis de l'utilisateur : ceux reçus (à accepter), à jouer (saisie du score) et à valider.

**[`frontend/src/pages/Chess.tsx`](../../frontend/src/pages/Chess.tsx)**

- `getHistoryResult` ([l.321](../../frontend/src/pages/Chess.tsx#L321)) — Résultat d'une partie de l'historique du point de vue de l'utilisateur : victoire, défaite, nulle ou abandon.
- `getHistoryReason` ([l.329](../../frontend/src/pages/Chess.tsx#L329)) — Libellé traduit de la raison de fin de partie.
- `opponentName` ([l.334](../../frontend/src/pages/Chess.tsx#L334)) — L'autre joueur d'une partie (nom d'affichage), « ? » s'il est inconnu.

**[`frontend/src/pages/History.tsx`](../../frontend/src/pages/History.tsx)**

- `History` ([l.6](../../frontend/src/pages/History.tsx#L6)) — Page d'historique : affiche la liste des matchs terminés de l'utilisateur (MatchHistoryList).

**[`frontend/src/pages/Ranking.tsx`](../../frontend/src/pages/Ranking.tsx)**

- `Ranking` ([l.123](../../frontend/src/pages/Ranking.tsx#L123)) — Page du classement Elo : recherche, filtres (périmètre, matchs minimum), tri et pagination côté serveur, podium et rang de l'utilisateur.

### Base de données

**[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)**

- `MatchFormat` ([l.41](../../backend/prisma/schema.prisma#L41)) — Format d'un match : 1v1 ou 2v2.
- `MatchStatus` ([l.47](../../backend/prisma/schema.prisma#L47)) — Cycle de vie d'un match.
- `Match` ([l.453](../../backend/prisma/schema.prisma#L453)) — Match (défi, scores, Elo, lien éventuel avec un tournoi).

## Comment le démontrer

- Jouer un match validé : voir l'Elo bouger, le match dans l'historique et la place au classement.

## Points à connaître / limites

- Le jeu « statistiques » principal est celui des matchs de babyfoot ; pour les échecs il y a l'historique mais pas encore de note/classement (voir module 06).
