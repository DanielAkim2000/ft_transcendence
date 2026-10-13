# Système de gamification

**Type** : Minor (1 pt)  ·  **Sujet** : IV.6 Gaming — « A gamification system to reward users for their actions »  ·  **Tag dans le code** : `[Minor · Gamification]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Minor · Gamification] … */` : cherchez `[Minor · Gamification]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Au moins 3 éléments parmi : succès, badges, classements, XP/niveaux, défis, récompenses.
- Persistant en base.
- Retour visuel (notifications, barres de progression).
- Règles claires.

## Ce qui est implémenté

Trois mécaniques : **badges** (7), **XP/niveaux** et **classement** (Elo). Tout est persisté ; les badges gagnés déclenchent un toast en direct et la progression s'affiche sur le profil.

## Logique utilisée

1. **XP/niveaux** (`lib/xp.ts`) : +10 XP par partie jouée, +20 bonus de victoire, +50 pour une victoire de tournoi ; 100 XP par niveau (`levelForXp`, `xpIntoLevel`).
2. **Badges** (`BadgeCode`) : première victoire, 10 victoires, 50 parties, série de 3 victoires, finaliste/champion de tournoi, « tombeur de géant » (victoire contre +150 Elo). `recordGameResult` met à jour compteurs/séries puis `checkMilestones`/`tryAward` attribuent les badges (une seule fois, `UserBadge`).
3. **Retour visuel** : `BadgesGateway` émet `badges:earned` ; `BadgesBootstrap` invalide le cache et affiche un toast ; `PlayerBadgesCard` montre niveau, barre d'XP, statistiques et badges obtenus/à débloquer.
4. **Source unique** : `BadgesService` est le seul à incrémenter `matchesPlayed` (évite un double comptage avec l'Elo).

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/badges/badges.controller.ts`](../../backend/src/badges/badges.controller.ts)**

- `BadgesController` ([l.5](../../backend/src/badges/badges.controller.ts#L5)) — Contrôleur HTTP des badges, de l'XP et des niveaux : routes REST protégées par les guards d'authentification.
- `getProfile` ([l.12](../../backend/src/badges/badges.controller.ts#L12)) — GET /badges/:userId : retourne le profil XP, niveau, statistiques et badges d'un joueur.

**[`backend/src/badges/badges.module.ts`](../../backend/src/badges/badges.module.ts)**

- `BadgesModule` ([l.11](../../backend/src/badges/badges.module.ts#L11)) — Module NestJS des badges, de l'XP et des niveaux : regroupe contrôleur, services et dépendances.

**[`backend/src/badges/entities/badge.entity.ts`](../../backend/src/badges/entities/badge.entity.ts)**

- `BadgeCode` ([l.1](../../backend/src/badges/entities/badge.entity.ts#L1)) — Codes des badges attribuables.
- `UserBadgeEntity` ([l.12](../../backend/src/badges/entities/badge.entity.ts#L12)) — Badge obtenu par un joueur (code, date).
- `constructor` ([l.17](../../backend/src/badges/entities/badge.entity.ts#L17)) — Copie dans l'instance les champs fournis.
- `PlayerBadgesProfile` ([l.23](../../backend/src/badges/entities/badge.entity.ts#L23)) — Profil de progression d'un joueur : XP, niveau, statistiques, badges.
- `constructor` ([l.41](../../backend/src/badges/entities/badge.entity.ts#L41)) — Copie dans l'instance les champs fournis.

**[`backend/src/badges/lib/xp.ts`](../../backend/src/badges/lib/xp.ts)**

- `levelForXp` ([l.11](../../backend/src/badges/lib/xp.ts#L11)) — Niveau du joueur (à partir de 1) pour un total d'XP donné.
- `xpIntoLevel` ([l.16](../../backend/src/badges/lib/xp.ts#L16)) — XP accumulée dans le niveau courant.
- `xpPerLevel` ([l.21](../../backend/src/badges/lib/xp.ts#L21)) — Nombre d'XP nécessaires pour passer un niveau.

**[`backend/src/badges/repositories/badges.repository.ts`](../../backend/src/badges/repositories/badges.repository.ts)**

- `BadgesRepository` ([l.17](../../backend/src/badges/repositories/badges.repository.ts#L17)) — Dépôt de données des badges, de l'XP et des niveaux : requêtes Prisma et conversion en entités.
- `recordWin` ([l.23](../../backend/src/badges/repositories/badges.repository.ts#L23)) — Enregistre une victoire : +1 match, +1 victoire, XP de partie et de victoire, série de victoires incrémentée (et meilleure série mise à jour).
- `recordLoss` ([l.42](../../backend/src/badges/repositories/badges.repository.ts#L42)) — Enregistre une défaite : +1 match, XP de participation, série de victoires remise à zéro.
- `recordDraw` ([l.54](../../backend/src/badges/repositories/badges.repository.ts#L54)) — Enregistre un match nul : +1 match, XP de participation, série de victoires remise à zéro.
- `shiftWin` ([l.66](../../backend/src/badges/repositories/badges.repository.ts#L66)) — Ajuste le décompte de victoires d'un joueur après la correction d'un résultat (+1 ou −1 victoire, avec l'XP de victoire correspondante).
- `recomputeStreaks` ([l.77](../../backend/src/badges/repositories/badges.repository.ts#L77)) — Recalcule la série de victoires en cours et la meilleure série d'un joueur à partir de ses matchs terminés (dans l'ordre où ils ont été joués).
- `addBonusXp` ([l.115](../../backend/src/badges/repositories/badges.repository.ts#L115)) — Ajoute un montant d'XP bonus à l'utilisateur.
- `getStats` ([l.123](../../backend/src/badges/repositories/badges.repository.ts#L123)) — Retourne les statistiques de jeu de l'utilisateur (victoires, matchs, séries), ou null s'il n'existe pas.
- `award` ([l.136](../../backend/src/badges/repositories/badges.repository.ts#L136)) — Retourne true si le badge vient d'être débloqué (false s'il l'était déjà).
- `getProfile` ([l.152](../../backend/src/badges/repositories/badges.repository.ts#L152)) — Construit le profil complet du joueur (XP, niveau, progression, stats, badges obtenus), ou null s'il n'existe pas.

**[`backend/src/badges/services/badges.service.ts`](../../backend/src/badges/services/badges.service.ts)**

- `GameResultInput` ([l.12](../../backend/src/badges/services/badges.service.ts#L12)) — Résultat d'un match transmis à la gamification (joueurs, vainqueurs).
- `BadgesService` ([l.22](../../backend/src/badges/services/badges.service.ts#L22)) — Service métier des badges, de l'XP et des niveaux.
- `constructor` ([l.25](../../backend/src/badges/services/badges.service.ts#L25)) — Injecte les dépendances : BadgesRepository, BadgesGateway, NotificationsService.
- `recordGameResult` ([l.32](../../backend/src/badges/services/badges.service.ts#L32)) — Enregistre le résultat d'une partie : stats/XP des gagnants et perdants, badges de jalons, et badge « tombeur » si les gagnants ont battu une équipe …
- `swapGameResult` ([l.57](../../backend/src/badges/services/badges.service.ts#L57)) — Corrige les statistiques quand le résultat d'une partie est inversé après coup : les anciens gagnants perdent une victoire, les anciens perdants en g…
- `recordDraw` ([l.76](../../backend/src/badges/services/badges.service.ts#L76)) — Enregistre un match nul pour chaque joueur (XP de participation, série de victoires remise à zéro) puis vérifie les badges de jalons.
- `awardTournamentFinalists` ([l.86](../../backend/src/badges/services/badges.service.ts#L86)) — Attribue le badge de finaliste de tournoi à chaque joueur donné.
- `awardTournamentChampion` ([l.93](../../backend/src/badges/services/badges.service.ts#L93)) — Donne le bonus d'XP de victoire de tournoi et le badge de champion à chaque joueur donné.
- `getProfile` ([l.101](../../backend/src/badges/services/badges.service.ts#L101)) — Retourne le profil de badges/XP d'un joueur ou lève une NotFoundException s'il n'existe pas.
- `checkMilestones` ([l.113](../../backend/src/badges/services/badges.service.ts#L113)) — Attribue les badges de jalons atteints (première victoire, 10 victoires, 50 matchs, série de 3 victoires).
- `tryAward` ([l.125](../../backend/src/badges/services/badges.service.ts#L125)) — Attribue un badge et, s'il vient d'être débloqué, notifie le joueur en temps réel (badges:earned).

### Frontend (React)

**[`frontend/src/features/badges/BadgesBootstrap.tsx`](../../frontend/src/features/badges/BadgesBootstrap.tsx)**

- `onEarned` ([l.27](../../frontend/src/features/badges/BadgesBootstrap.tsx#L27)) — Quand le serveur annonce un badge gagné : invalide le cache des badges du joueur et affiche un toast de félicitations.

**[`frontend/src/features/badges/PlayerBadgesCard.tsx`](../../frontend/src/features/badges/PlayerBadgesCard.tsx)**

- `PlayerBadgesCard` ([l.11](../../frontend/src/features/badges/PlayerBadgesCard.tsx#L11)) — Carte d'un joueur : niveau, barre de progression d'XP, statistiques (victoires, défaites, série) et badges obtenus ou à débloquer.

**[`frontend/src/features/badges/badgesApi.ts`](../../frontend/src/features/badges/badgesApi.ts)**

- `badgesApi` ([l.37](../../frontend/src/features/badges/badgesApi.ts#L37)) — Endpoints RTK Query du domaine « badges » (requêtes/mutations typées, cache et invalidation par tags) : GET_BADGES.

### Base de données

**[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)**

- `BadgeCode` ([l.75](../../backend/prisma/schema.prisma#L75)) — Badges attribuables.
- `UserBadge` ([l.570](../../backend/prisma/schema.prisma#L570)) — Badge obtenu par un utilisateur.

## Comment le démontrer

- Gagner un match : XP et badge « première victoire » (toast), niveau visible sur le profil.
