# Système de tournois

**Type** : Minor (1 pt)  ·  **Sujet** : IV.6 Gaming — « Implement a tournament system »  ·  **Tag dans le code** : `[Minor · Tournois]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Minor · Tournois] … */` : cherchez `[Minor · Tournois]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Ordre des rencontres et tableau.
- Suivi de qui joue contre qui.
- Matchmaking des participants.
- Inscription et gestion.

## Ce qui est implémenté

Tournois à **élimination directe** (tableau de 4, 8, 16… inscriptions), 1v1 ou 2v2 à équipes fixes, avec option **aller-retour**. Création/inscriptions/lancement/annulation par un administrateur, tirage au sort, avancement automatique des vainqueurs, attribution de points de classement par tour, corrections de score et remplacement de joueur.

## Logique utilisée

1. **Tableau** (`lib/bracket.ts`) : `shuffle` (Fisher-Yates) pour le tirage, `isPowerOfTwo`/`log2` pour valider la taille et compter les tours, `roundLabel` (finale, demi, quart…), `pointsForRound` (10 × n° du tour), `resolveTie` (qui gagne une confrontation à une ou deux manches) et `planLegCorrection` (impact d'une correction de score).
2. **Service** : `launch`/`start` crée les confrontations et les manches, réserve des tables (`scheduleFreeTables`, `claimForTournament`) et démarre les rencontres prêtes ; `handleLegCompleted` → `finishTie` fait avancer le vainqueur, attribue les points, élimine, ou clôt le tournoi ; `correctLegScore` recalcule le tableau.
3. **Front** : `TournamentNew`, `TournamentDetail` (bracket, inscriptions, lancement), `TieCard` (saisie/validation du score), `LegCorrection`, `ReplacePlayerDialog` ; `TournamentsBootstrap` pousse toasts et mises à jour en direct.

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/matches/matches.controller.ts`](../../backend/src/matches/matches.controller.ts)**

- `submitTournamentScore` ([l.108](../../backend/src/matches/matches.controller.ts#L108)) — POST /matches/:matchId/admin-score (admin) : saisit le score d'une manche de tournoi, qui est alors terminée (les joueurs ne peuvent pas saisir les s…
- `correctTournamentScore` ([l.124](../../backend/src/matches/matches.controller.ts#L124)) — PATCH /matches/:matchId/admin-score (admin) : corrige le score d'une manche de tournoi déjà terminée ; le tournoi est recalculé (ou la correction ref…

**[`backend/src/matches/services/matches.service.ts`](../../backend/src/matches/services/matches.service.ts)**

- `submitTournamentScoreAsAdmin` ([l.305](../../backend/src/matches/services/matches.service.ts#L305)) — Un administrateur saisit le score d'une manche de tournoi : seul moyen d'en enregistrer un.
- `correctTournamentScoreAsAdmin` ([l.346](../../backend/src/matches/services/matches.service.ts#L346)) — Un administrateur corrige le score déjà saisi d'une manche de tournoi terminée.

**[`backend/src/tournaments/dtos/add-entry.dto.ts`](../../backend/src/tournaments/dtos/add-entry.dto.ts)**

- `AddEntryDto` ([l.3](../../backend/src/tournaments/dtos/add-entry.dto.ts#L3)) — Corps validé d'ajout d'une inscription à un tournoi.

**[`backend/src/tournaments/dtos/create-tournament.dto.ts`](../../backend/src/tournaments/dtos/create-tournament.dto.ts)**

- `TournamentEntryDto` ([l.15](../../backend/src/tournaments/dtos/create-tournament.dto.ts#L15)) — Inscription (un ou deux joueurs) à la création d'un tournoi.
- `CreateTournamentDto` ([l.26](../../backend/src/tournaments/dtos/create-tournament.dto.ts#L26)) — Corps validé de création d'un tournoi (nom, format, aller-retour, inscriptions).

**[`backend/src/tournaments/dtos/replace-player.dto.ts`](../../backend/src/tournaments/dtos/replace-player.dto.ts)**

- `ReplacePlayerDto` ([l.3](../../backend/src/tournaments/dtos/replace-player.dto.ts#L3)) — Corps validé du remplacement d'un joueur d'une inscription.

**[`backend/src/tournaments/entities/tournament.entity.ts`](../../backend/src/tournaments/entities/tournament.entity.ts)**

- `TournamentStatus` ([l.3](../../backend/src/tournaments/entities/tournament.entity.ts#L3)) — États d'un tournoi (brouillon, en cours, terminé, annulé).
- `TournamentTieStatus` ([l.12](../../backend/src/tournaments/entities/tournament.entity.ts#L12)) — États d'une confrontation (en attente, prête, en cours, terminée).
- `TournamentPlayer` ([l.20](../../backend/src/tournaments/entities/tournament.entity.ts#L20)) — Joueur d'une inscription de tournoi.
- `TournamentEntryEntity` ([l.28](../../backend/src/tournaments/entities/tournament.entity.ts#L28)) — Inscription (équipe) à un tournoi.
- `constructor` ([l.36](../../backend/src/tournaments/entities/tournament.entity.ts#L36)) — Copie dans l'instance les champs fournis.
- `TournamentTieEntity` ([l.42](../../backend/src/tournaments/entities/tournament.entity.ts#L42)) — Confrontation du bracket avec ses manches.
- `constructor` ([l.73](../../backend/src/tournaments/entities/tournament.entity.ts#L73)) — Copie dans l'instance les champs fournis.
- `TournamentEntity` ([l.79](../../backend/src/tournaments/entities/tournament.entity.ts#L79)) — Tournoi avec ses inscriptions et son bracket.
- `constructor` ([l.95](../../backend/src/tournaments/entities/tournament.entity.ts#L95)) — Copie dans l'instance les champs fournis.

**[`backend/src/tournaments/lib/bracket.ts`](../../backend/src/tournaments/lib/bracket.ts)**

- `shuffle` ([l.1](../../backend/src/tournaments/lib/bracket.ts#L1)) — Mélange Fisher-Yates, pour le tirage au sort du tableau.
- `roundLabel` ([l.11](../../backend/src/tournaments/lib/bracket.ts#L11)) — round est 1-indexé depuis le 1er tour ; totalRounds = log2(nombre d'entrées).
- `pointsForRound` ([l.23](../../backend/src/tournaments/lib/bracket.ts#L23)) — Points gagnés par le vainqueur d'une rencontre : 10 × numéro du tour.
- `isPowerOfTwo` ([l.28](../../backend/src/tournaments/lib/bracket.ts#L28)) — Indique si n est une puissance de 2 supérieure ou égale à 2 (taille valide pour un tableau).
- `log2` ([l.33](../../backend/src/tournaments/lib/bracket.ts#L33)) — Logarithme base 2 arrondi : nombre de tours d'un tableau de n entrées.
- `TieLeg` ([l.38](../../backend/src/tournaments/lib/bracket.ts#L38)) — Manche d'une confrontation (numéro, statut, scores).
- `TieResolution` ([l.46](../../backend/src/tournaments/lib/bracket.ts#L46)) — Résultat du calcul d'une confrontation (vainqueur, manche suivante).
- `resolveTie` ([l.56](../../backend/src/tournaments/lib/bracket.ts#L56)) — 
- `LegCorrectionPlan` ([l.113](../../backend/src/tournaments/lib/bracket.ts#L113)) — Plan de correction d'un score de manche (impact sur le bracket).
- `planLegCorrection` ([l.125](../../backend/src/tournaments/lib/bracket.ts#L125)) — Prévoit l'effet de la correction du score d'une manche terminée sur sa rencontre (sans rien modifier).

**[`backend/src/tournaments/repositories/tournaments.repository.ts`](../../backend/src/tournaments/repositories/tournaments.repository.ts)**

- `TournamentsRepository` ([l.78](../../backend/src/tournaments/repositories/tournaments.repository.ts#L78)) — Dépôt de données des tournois : requêtes Prisma et conversion en entités.
- `create` ([l.84](../../backend/src/tournaments/repositories/tournaments.repository.ts#L84)) — Crée un tournoi en brouillon avec ses entrées initiales (seed attribué dans l'ordre).
- `addEntry` ([l.111](../../backend/src/tournaments/repositories/tournaments.repository.ts#L111)) — Ajoute une entrée au tournoi avec le seed suivant (dernier seed + 1).
- `removeEntry` ([l.132](../../backend/src/tournaments/repositories/tournaments.repository.ts#L132)) — Supprime une entrée du tournoi ; retourne false si elle n'existe pas.
- `replaceEntryPlayer` ([l.140](../../backend/src/tournaments/repositories/tournaments.repository.ts#L140)) — Remplace un joueur d'une entrée par un autre, y compris dans les manches en cours (acceptées ou en attente de validation) de ses rencontres ; les man…
- `findById` ([l.188](../../backend/src/tournaments/repositories/tournaments.repository.ts#L188)) — Retrouve un tournoi complet (entrées, rencontres) par id, ou null.
- `listPage` ([l.197](../../backend/src/tournaments/repositories/tournaments.repository.ts#L197)) — Liste une page de tournois (les plus récents d'abord) avec leurs détails, plus le total.
- `countActiveLegsForUser` ([l.216](../../backend/src/tournaments/repositories/tournaments.repository.ts#L216)) — Nombre de manches (dans un tournoi en cours) que l'utilisateur doit jouer ou valider.
- `launch` ([l.235](../../backend/src/tournaments/repositories/tournaments.repository.ts#L235)) — Statut DRAFT requis pour être lancé (vérifié par le service).
- `cancel` ([l.272](../../backend/src/tournaments/repositories/tournaments.repository.ts#L272)) — Passe le tournoi en statut CANCELLED et clôt ses manches en cours (en litige) pour qu'aucun joueur n'ait plus de score à saisir ou valider.
- `markQueued` ([l.291](../../backend/src/tournaments/repositories/tournaments.repository.ts#L291)) — Met le tournoi en file d'attente (un autre tournoi est en cours).
- `countInProgress` ([l.299](../../backend/src/tournaments/repositories/tournaments.repository.ts#L299)) — Nombre de tournois en cours (au plus un en régime normal).
- `listInProgressIds` ([l.306](../../backend/src/tournaments/repositories/tournaments.repository.ts#L306)) — Ids des tournois en cours, du plus ancien au plus récent.
- `findNextQueuedId` ([l.316](../../backend/src/tournaments/repositories/tournaments.repository.ts#L316)) — Id du tournoi en file d'attente depuis le plus longtemps, ou null.
- `complete` ([l.326](../../backend/src/tournaments/repositories/tournaments.repository.ts#L326)) — Passe le tournoi en COMPLETED et enregistre la date de fin.
- `findReadyTies` ([l.334](../../backend/src/tournaments/repositories/tournaments.repository.ts#L334)) — Rencontres READY (les deux entrées connues, aucune manche en cours) d'un tournoi.
- `findTieById` ([l.346](../../backend/src/tournaments/repositories/tournaments.repository.ts#L346)) — Retrouve une rencontre avec ses deux entrées, ses manches (triées) et son tournoi.
- `findTieByRoundSlot` ([l.359](../../backend/src/tournaments/repositories/tournaments.repository.ts#L359)) — Retrouve la rencontre d'un tournoi à partir de son tour et de son emplacement dans le tableau.
- `updateLegScore` ([l.373](../../backend/src/tournaments/repositories/tournaments.repository.ts#L373)) — Remplace le score d'une manche de tournoi déjà terminée ; false si la manche n'existe pas ou n'est pas terminée.
- `deleteUnplayedLeg` ([l.390](../../backend/src/tournaments/repositories/tournaments.repository.ts#L390)) — Supprime une manche de tournoi créée mais jamais jouée (acceptée, sans aucun score) ; false si elle a reçu un score entre-temps.
- `clearLegRatingDeltas` ([l.403](../../backend/src/tournaments/repositories/tournaments.repository.ts#L403)) — Efface l'historique des points de tournoi gagnés enregistré sur une manche.
- `reopenTie` ([l.411](../../backend/src/tournaments/repositories/tournaments.repository.ts#L411)) — Rouvre une rencontre décidée : prête à être (re)jouée, sans vainqueur ni points.
- `clearAdvancedEntry` ([l.423](../../backend/src/tournaments/repositories/tournaments.repository.ts#L423)) — Vide un côté de la rencontre du tour suivant (le vainqueur qui y avait avancé change) ; la rencontre redevient en attente d'un adversaire.
- `findLegMeta` ([l.445](../../backend/src/tournaments/repositories/tournaments.repository.ts#L445)) — Retourne l'id de la rencontre et de la table d'une manche, ou null si le match n'appartient pas à un tournoi.
- `createLeg` ([l.459](../../backend/src/tournaments/repositories/tournaments.repository.ts#L459)) — Crée la manche (Match) suivante d'une rencontre et la lie à la table réservée.
- `markTieReady` ([l.489](../../backend/src/tournaments/repositories/tournaments.repository.ts#L489)) — Remet une rencontre au statut READY (prête à être jouée sur une table).
- `markTieDone` ([l.497](../../backend/src/tournaments/repositories/tournaments.repository.ts#L497)) — Clôt une rencontre : statut DONE, entrée gagnante et points attribués.
- `advanceWinner` ([l.509](../../backend/src/tournaments/repositories/tournaments.repository.ts#L509)) — Fait avancer le vainqueur dans la rencontre du tour suivant ; renvoie true si les 2 côtés de celle-ci sont désormais connus.
- `awardRatingBonus` ([l.539](../../backend/src/tournaments/repositories/tournaments.repository.ts#L539)) — Ajoute les points de tournoi à la note de chaque joueur gagnant.
- `setLegRatingDeltas` ([l.547](../../backend/src/tournaments/repositories/tournaments.repository.ts#L547)) — Enregistre sur la manche décisive les points de tournoi gagnés, pour l'historique.
- `getLegOutcome` ([l.561](../../backend/src/tournaments/repositories/tournaments.repository.ts#L561)) — Score + composition de la manche qui vient d'être jouée (pour les badges : victoire/défaite de CETTE manche).
- `findInProgressTies` ([l.583](../../backend/src/tournaments/repositories/tournaments.repository.ts#L583)) — Rencontres encore actives (manche en cours) d'un tournoi, pour libérer leurs tables à l'annulation.
- `toEntity` ([l.599](../../backend/src/tournaments/repositories/tournaments.repository.ts#L599)) — Convertit un tournoi Prisma en TournamentEntity (rencontres converties ; le champion est le vainqueur de la finale une fois le tournoi terminé).
- `entryToEntity` ([l.641](../../backend/src/tournaments/repositories/tournaments.repository.ts#L641)) — Convertit une entrée Prisma en TournamentEntryEntity.
- `tieToEntity` ([l.655](../../backend/src/tournaments/repositories/tournaments.repository.ts#L655)) — Convertit une rencontre Prisma en TournamentTieEntity : libellé du tour, manche active, manches jouées/nécessaires et score cumulé.

**[`backend/src/tournaments/services/tournaments.service.ts`](../../backend/src/tournaments/services/tournaments.service.ts)**

- `TournamentsService` ([l.36](../../backend/src/tournaments/services/tournaments.service.ts#L36)) — Service métier des tournois.
- `constructor` ([l.41](../../backend/src/tournaments/services/tournaments.service.ts#L41)) — Injecte les dépendances : TournamentsRepository, TournamentsGateway, UsersService, TablesService, QueueService, BadgesService, NotificationsService.
- `listPage` ([l.52](../../backend/src/tournaments/services/tournaments.service.ts#L52)) — Liste une page de tournois.
- `countPendingActions` ([l.59](../../backend/src/tournaments/services/tournaments.service.ts#L59)) — Nombre de manches de tournoi que l'utilisateur doit jouer ou valider (pastille de la barre latérale).
- `getById` ([l.66](../../backend/src/tournaments/services/tournaments.service.ts#L66)) — Retrouve un tournoi par id ou lève une NotFoundException.
- `create` ([l.78](../../backend/src/tournaments/services/tournaments.service.ts#L78)) — Crée un tournoi en brouillon après validation des entrées, puis le diffuse à tous les clients.
- `addEntry` ([l.98](../../backend/src/tournaments/services/tournaments.service.ts#L98)) — Ajoute une entrée à un tournoi encore en brouillon, après validation de l'ensemble des entrées, puis diffuse la mise à jour.
- `removeEntry` ([l.128](../../backend/src/tournaments/services/tournaments.service.ts#L128)) — Retire une entrée d'un tournoi encore en brouillon puis diffuse la mise à jour.
- `replacePlayer` ([l.153](../../backend/src/tournaments/services/tournaments.service.ts#L153)) — Remplace un joueur d'une équipe (brouillon, en file ou en cours) : par exemple quand un joueur ne peut plus jouer.
- `launch` ([l.226](../../backend/src/tournaments/services/tournaments.service.ts#L226)) — 
- `start` ([l.263](../../backend/src/tournaments/services/tournaments.service.ts#L263)) — Démarre réellement un tournoi (tirage au sort, réservation des tables, notifications, premières rencontres).
- `cancel` ([l.338](../../backend/src/tournaments/services/tournaments.service.ts#L338)) — Annule un tournoi non terminé (brouillon, en file ou en cours) : libère ses tables, clôt ses manches en cours, diffuse la mise à jour puis fait démar…
- `startNextQueued` ([l.362](../../backend/src/tournaments/services/tournaments.service.ts#L362)) — Quand plus aucun tournoi n'est en cours, démarre celui qui attend depuis le plus longtemps dans la file (sans effet sinon).
- `scheduleAllRunning` ([l.375](../../backend/src/tournaments/services/tournaments.service.ts#L375)) — Distribue les tables libres aux rencontres prêtes de tous les tournois en cours, le plus ancien d'abord.
- `handleLegCompleted` ([l.382](../../backend/src/tournaments/services/tournaments.service.ts#L382)) — Appelé par MatchesService quand une manche de tournoi vient d'être validée.
- `finishTie` ([l.440](../../backend/src/tournaments/services/tournaments.service.ts#L440)) — Clôt une rencontre décidée : vainqueur et points, bonus de note, badges, avancée dans le tableau (ou fin du tournoi si c'est la finale), notification…
- `correctLegScore` ([l.556](../../backend/src/tournaments/services/tournaments.service.ts#L556)) — 
- `toTieLegs` ([l.610](../../backend/src/tournaments/services/tournaments.service.ts#L610)) — Convertit les manches (legs) de la confrontation au format attendu par planLegCorrection (numéro, statut, scores).
- `cancelUnplayedLegs` ([l.757](../../backend/src/tournaments/services/tournaments.service.ts#L757)) — Annule les matchs du tour suivant qui ont été créés mais jamais joués (table libérée, match supprimé) parce que l'équipe qui y avait avancé change ; …
- `handleLegDisputed` ([l.792](../../backend/src/tournaments/services/tournaments.service.ts#L792)) — Appelé par MatchesService quand une manche de tournoi part en litige (ou expire) : on la rejoue.
- `findLegMeta` ([l.804](../../backend/src/tournaments/services/tournaments.service.ts#L804)) — Retourne la rencontre et la table liées à une manche (match) de tournoi, ou null si le match n'en est pas une.
- `scheduleFreeTables` ([l.811](../../backend/src/tournaments/services/tournaments.service.ts#L811)) — Distribue les rencontres prêtes sur les tables libres, une table libre <-> une rencontre au hasard.
- `validateEntries` ([l.878](../../backend/src/tournaments/services/tournaments.service.ts#L878)) — Vérifie les entrées : joueur 2 requis en 2v2 et interdit en 1v1, pas de paire avec soi-même, aucun joueur en double, tous les joueurs existent.

**[`backend/src/tournaments/tournaments.controller.ts`](../../backend/src/tournaments/tournaments.controller.ts)**

- `TournamentsController` ([l.23](../../backend/src/tournaments/tournaments.controller.ts#L23)) — Contrôleur HTTP des tournois : routes REST protégées par les guards d'authentification.
- `listPage` ([l.30](../../backend/src/tournaments/tournaments.controller.ts#L30)) — GET /tournaments?page=&limit= : page des tournois, les plus récents d'abord.
- `countPendingActions` ([l.36](../../backend/src/tournaments/tournaments.controller.ts#L36)) — GET /tournaments/me/pending-actions : nombre de manches à jouer ou valider par l'utilisateur connecté.
- `getOne` ([l.42](../../backend/src/tournaments/tournaments.controller.ts#L42)) — GET /tournaments/:id : détail d'un tournoi (entrées, tableau, rencontres).
- `create` ([l.48](../../backend/src/tournaments/tournaments.controller.ts#L48)) — POST /tournaments (admin) : crée un tournoi en brouillon avec ses éventuelles entrées initiales.
- `addEntry` ([l.64](../../backend/src/tournaments/tournaments.controller.ts#L64)) — POST /tournaments/:id/entries (admin) : ajoute un joueur (ou une paire en 2v2) à un tournoi en brouillon.
- `removeEntry` ([l.71](../../backend/src/tournaments/tournaments.controller.ts#L71)) — DELETE /tournaments/:id/entries/:entryId (admin) : retire une entrée d'un tournoi en brouillon.
- `replacePlayer` ([l.78](../../backend/src/tournaments/tournaments.controller.ts#L78)) — PATCH /tournaments/:id/entries/:entryId/player (admin) : remplace un joueur de l'équipe (brouillon, en file ou en cours).
- `launch` ([l.94](../../backend/src/tournaments/tournaments.controller.ts#L94)) — POST /tournaments/:id/launch (admin) : tire au sort le tableau et démarre le tournoi.
- `cancel` ([l.101](../../backend/src/tournaments/tournaments.controller.ts#L101)) — POST /tournaments/:id/cancel (admin) : annule le tournoi et libère les tables réservées.

**[`backend/src/tournaments/tournaments.module.ts`](../../backend/src/tournaments/tournaments.module.ts)**

- `TournamentsModule` ([l.14](../../backend/src/tournaments/tournaments.module.ts#L14)) — Module NestJS des tournois : regroupe contrôleur, services et dépendances.

### Frontend (React)

**[`frontend/src/features/tournaments/LegCorrection.tsx`](../../frontend/src/features/tournaments/LegCorrection.tsx)**

- `LegRow` ([l.18](../../frontend/src/features/tournaments/LegCorrection.tsx#L18)) — Ligne d'une manche (leg) : score, statut et bouton de correction pour un administrateur.
- `open` ([l.49](../../frontend/src/features/tournaments/LegCorrection.tsx#L49)) — Ouvre l'édition d'un score en pré-remplissant les champs.
- `submit` ([l.56](../../frontend/src/features/tournaments/LegCorrection.tsx#L56)) — Envoie la correction du score (administrateur) et confirme ; le bracket est recalculé côté serveur.
- `LegCorrection` ([l.160](../../frontend/src/features/tournaments/LegCorrection.tsx#L160)) — Admin : liste les manches terminées d'une rencontre et permet d'en corriger le score (le tableau est recalculé par le backend).

**[`frontend/src/features/tournaments/ReplacePlayerDialog.tsx`](../../frontend/src/features/tournaments/ReplacePlayerDialog.tsx)**

- `ReplacePlayerDialog` ([l.28](../../frontend/src/features/tournaments/ReplacePlayerDialog.tsx#L28)) — Fenêtre (admin) pour remplacer un joueur d'une équipe, par exemple quand elle ne peut plus jouer sa demi-finale.
- `reset` ([l.53](../../frontend/src/features/tournaments/ReplacePlayerDialog.tsx#L53)) — Remet à zéro la recherche et la sélection du remplaçant.
- `handleConfirm` ([l.61](../../frontend/src/features/tournaments/ReplacePlayerDialog.tsx#L61)) — Remplace un joueur d'une inscription par le remplaçant choisi (tournoi non lancé).

**[`frontend/src/features/tournaments/TieCard.tsx`](../../frontend/src/features/tournaments/TieCard.tsx)**

- `entryName` ([l.22](../../frontend/src/features/tournaments/TieCard.tsx#L22)) — Libellé d'une inscription (un ou deux joueurs, ou « à déterminer »).
- `EntrySide` ([l.33](../../frontend/src/features/tournaments/TieCard.tsx#L33)) — Côté d'une confrontation : inscription, joueurs et score ou état.
- `TieCard` ([l.70](../../frontend/src/features/tournaments/TieCard.tsx#L70)) — Carte d'une confrontation du bracket : adversaires, manches, saisie/validation du score par les joueurs et corrections d'administrateur.
- `isIn` ([l.99](../../frontend/src/features/tournaments/TieCard.tsx#L99)) — Vrai si l'utilisateur fait partie de l'inscription donnée.
- `run` ([l.110](../../frontend/src/features/tournaments/TieCard.tsx#L110)) — Exécute une action (saisie, validation) avec toast de succès ou d'erreur.
- `submit` ([l.138](../../frontend/src/features/tournaments/TieCard.tsx#L138)) — Envoie le score de la manche active (si valide).

**[`frontend/src/features/tournaments/TournamentsBootstrap.tsx`](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx)**

- `tournamentName` ([l.12](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx#L12)) — Retrouve le nom d'un tournoi (cache ou requête) pour les toasts.
- `goToTournaments` ([l.34](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx#L34)) — Navigue vers la liste des tournois.
- `goToTables` ([l.36](../../frontend/src/features/tournaments/TournamentsBootstrap.tsx#L36)) — Navigue vers la page des tables.

**[`frontend/src/features/tournaments/tournamentHelpers.ts`](../../frontend/src/features/tournaments/tournamentHelpers.ts)**

- `translateRoundLabel` ([l.3](../../frontend/src/features/tournaments/tournamentHelpers.ts#L3)) — Traduit un roundLabel ("FINAL", "SEMI"...) ; retombe sur "Tour N" pour les tableaux plus grands.
- `entryLabel` ([l.15](../../frontend/src/features/tournaments/tournamentHelpers.ts#L15)) — Nom d'une équipe de tournoi (« Joueur1 + Joueur2 » en double), ou le libellé « à déterminer » si elle n'est pas encore connue.

**[`frontend/src/features/tournaments/tournamentsApi.ts`](../../frontend/src/features/tournaments/tournamentsApi.ts)**

- `tournamentsApi` ([l.68](../../frontend/src/features/tournaments/tournamentsApi.ts#L68)) — Endpoints RTK Query du domaine « tournaments » (requêtes/mutations typées, cache et invalidation par tags) : LIST_TOURNAMENTS, COUNT_TOURNAMENT_ACTIO…
- `applyTournamentToCache` ([l.144](../../frontend/src/features/tournaments/tournamentsApi.ts#L144)) — Un tournoi a changé (websocket) : on met à jour son détail dans le cache et on recharge les listes, paginées côté backend.

**[`frontend/src/pages/TournamentDetail.tsx`](../../frontend/src/pages/TournamentDetail.tsx)**

- `isPowerOfTwo` ([l.27](../../frontend/src/pages/TournamentDetail.tsx#L27)) — Vrai si le nombre d'inscriptions est une puissance de deux d'au moins 4 (condition pour lancer un tournoi).
- `TournamentDetail` ([l.32](../../frontend/src/pages/TournamentDetail.tsx#L32)) — Page d'un tournoi : inscriptions, bracket par tours, lancement, annulation, remplacement de joueur et corrections de score.
- `run` ([l.59](../../frontend/src/pages/TournamentDetail.tsx#L59)) — Exécute une action sur le tournoi avec toast d'erreur.
- `pickUser` ([l.77](../../frontend/src/pages/TournamentDetail.tsx#L77)) — Ajoute un joueur choisi (en solo ou comme 2e joueur d'une paire en 2v2) aux inscriptions.

**[`frontend/src/pages/TournamentNew.tsx`](../../frontend/src/pages/TournamentNew.tsx)**

- `TournamentNew` ([l.27](../../frontend/src/pages/TournamentNew.tsx#L27)) — Page de création d'un tournoi : nom, format (1v1/2v2), aller-retour, inscriptions initiales.
- `pickUser` ([l.58](../../frontend/src/pages/TournamentNew.tsx#L58)) — Ajoute un joueur aux inscriptions (ou forme une paire en 2v2) en évitant les doublons.
- `removeEntry` ([l.84](../../frontend/src/pages/TournamentNew.tsx#L84)) — Retire une inscription de la liste.
- `submit` ([l.89](../../frontend/src/pages/TournamentNew.tsx#L89)) — Crée le tournoi avec ses inscriptions puis ouvre sa page.

**[`frontend/src/pages/Tournaments.tsx`](../../frontend/src/pages/Tournaments.tsx)**

- `Tournaments` ([l.23](../../frontend/src/pages/Tournaments.tsx#L23)) — Page des tournois : liste paginée avec statut et accès à la création pour les administrateurs.

### Base de données

**[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)**

- `TournamentStatus` ([l.57](../../backend/prisma/schema.prisma#L57)) — États d'un tournoi.
- `TournamentTieStatus` ([l.67](../../backend/prisma/schema.prisma#L67)) — États d'une confrontation du bracket.
- `Tournament` ([l.500](../../backend/prisma/schema.prisma#L500)) — Tournoi.
- `TournamentEntry` ([l.522](../../backend/prisma/schema.prisma#L522)) — Inscription (joueur ou paire) à un tournoi.
- `TournamentTie` ([l.544](../../backend/prisma/schema.prisma#L544)) — Confrontation du bracket (et ses manches).

## Comment le démontrer

- Créer un tournoi à 4 joueurs, le lancer, jouer les confrontations et voir le tableau avancer jusqu'au vainqueur.

## Points à connaître / limites

- Les rencontres se jouent sur les tables de babyfoot, pas aux échecs : à présenter comme le tournoi du jeu « babyfoot » de l'application.
