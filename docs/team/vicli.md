# `vicli` — Tournois

> Un fichier par membre de l'équipe dans `docs/team/`, chacun explique en profondeur — jusqu'au niveau du code — la partie qui lui revient. Les 5 fichiers mis bout à bout couvrent **tout** le projet : [`demane.md`](./demane.md) (socle), [`rdinis.md`](./rdinis.md) (Tables & Queue), [`rbourdon.md`](./rbourdon.md) (Match & Elo), [`bbouarab.md`](./bbouarab.md) (Gamification). Vision produit et règles métier globales : [`../PLAN.md`](../PLAN.md).

C'est le module le plus complexe du projet : il **orchestre** les trois autres (Tables, Queue, Match & Elo) plutôt que de réinventer quoi que ce soit. Lis [`rdinis.md`](./rdinis.md) et [`rbourdon.md`](./rbourdon.md) d'abord si ce n'est pas déjà fait, et prends le temps de lire ce fichier en entier avant de le présenter.

## 1. Le besoin, en une phrase

Un admin organise un tournoi à élimination directe entre joueurs inscrits. Une fois lancé, le moteur doit **tout faire seul** : construire le tableau, attribuer les tables disponibles aux rencontres prêtes à jouer, encaisser chaque score, faire avancer les vainqueurs, jusqu'au champion — sans intervention manuelle sur les tables.

## 2. Règles métier

1. **Admin only** pour créer/lancer/annuler (`RolesGuard` + `@AuthRoles(Role.ADMIN)`).
2. Format à la création : **1v1 ou 2v2**, **aller simple ou aller-retour** (`twoLegged`).
3. Participants **imposés en puissance de 2** (4, 8, 16…) — pas de gestion de "bye".
4. **Tirage au sort aléatoire** au lancement (Fisher-Yates, `shuffle()`).
5. **Points fixes par tour**, gagnés uniquement par le vainqueur : `10 × numéro du tour` (`pointsForRound()`). **Volontairement différent** de l'Elo classique (pas relatif au classement de l'adversaire) — une victoire de finale rapporte mécaniquement plus qu'une victoire de quart, quel que soit le niveau des deux joueurs. Ces points s'ajoutent au **même** Elo que le classement normal (`User.rating`, voir [rbourdon.md](./rbourdon.md)).
6. **Aller-retour** : décision à l'addition des deux scores ; égalité après 2 manches → une 3e manche ("la belle") tranche seule.
7. **Litige sur une manche** → rejouée automatiquement (pas de forfait).
8. **Au lancement** : les 2 tables sont **libérées de force** et leurs files vidées ; elles restent réservées au tournoi jusqu'à ce qu'il n'en ait plus besoin.
9. Attribution des tables **aléatoire à chaque rencontre** ; deux rencontres d'un tour tournent **en parallèle** sur les deux tables si elles sont prêtes en même temps.

## 3. Modèle de données

- **`Tournament`** — `name`, `format`, `twoLegged`, `status` (`DRAFT`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`), `totalRounds`, `createdBy`.
- **`TournamentEntry`** — une place dans le tableau (1 ou 2 joueurs via `player1Id`/`player2Id`), `eliminatedRound`.
- **`TournamentTie`** — une rencontre (`round`, `slot`), `entryAId`/`entryBId` (nuls tant que pas connus), `status` (`PENDING`/`READY`/`IN_PROGRESS`/`DONE`), `winnerEntryId`, `pointsAwarded`. Ses manches sont des `Match` normaux (voir [rbourdon.md](./rbourdon.md)) reliés par `tournamentTieId` + `legNumber`.
- `Table.currentTournamentTieId` — voir [rdinis.md](./rdinis.md).

## 4. Construire le tableau : exemple concret à 8 joueurs

`totalRounds = log2(8) = 3` (quart, demi, finale). Au lancement (`TournamentsService.launch()`) :

```ts
const shuffledIds = shuffle(tournament.entries.map((entry) => entry.id)); // tirage au sort
const firstRoundPairs = Array.from({ length: count / 2 }, (_, slot) => ({
  slot, entryAId: shuffledIds[slot * 2], entryBId: shuffledIds[slot * 2 + 1],
})); // round 1 (quarts) : 4 rencontres READY avec leurs 2 entrées déjà connues
```
Pour les tours suivants, on crée des rencontres "**coquilles**" — `PENDING`, sans entrées, juste leur position :
```ts
for (let round = 2; round <= totalRounds; round++) {
  const slots = count / 2 ** round; // round 2 (demi) : 2 slots ; round 3 (finale) : 1 slot
  for (let slot = 0; slot < slots; slot++) futureRounds.push({ round, slot });
}
```
Elles se remplissent au fur et à mesure via `advanceWinner()` (§6). Ce mécanisme évite d'avoir à générer dynamiquement le tableau à chaque tour — toute la structure existe dès le lancement.

**Traduction des tours** (`roundLabel()`) : `FINAL` (dernier tour), `SEMI` (avant-dernier), `QUARTER`, `ROUND_OF_16`, sinon `ROUND_N` générique (grands tableaux).

## 5. `resolveTie()` — décider qui a gagné une rencontre

Fonction pure (`backend/src/tournaments/lib/bracket.ts`) :

```ts
export function resolveTie(twoLegged: boolean, legs: TieLeg[]): TieResolution {
  const completed = legs.filter((leg) => leg.status === 'COMPLETED').sort((a, b) => a.legNumber - b.legNumber);
  if (!twoLegged) {
    const leg = completed[0];
    if (!leg) return { done: false, winnerSide: null, nextLegNumber: 1 };
    return { done: true, winnerSide: leg.scoreA > leg.scoreB ? 'A' : 'B', nextLegNumber: null };
  }
  if (completed.length < 2) return { done: false, winnerSide: null, nextLegNumber: completed.length + 1 };
  const aggregateA = completed.slice(0, 2).reduce((s, l) => s + (l.scoreA ?? 0), 0);
  const aggregateB = completed.slice(0, 2).reduce((s, l) => s + (l.scoreB ?? 0), 0);
  if (aggregateA !== aggregateB) return { done: true, winnerSide: aggregateA > aggregateB ? 'A' : 'B', nextLegNumber: null };
  const decider = completed.find((leg) => leg.legNumber === 3); // égalité → la belle tranche seule
  if (!decider) return { done: false, winnerSide: null, nextLegNumber: 3 };
  return { done: true, winnerSide: decider.scoreA > decider.scoreB ? 'A' : 'B', nextLegNumber: null };
}
```

**Exemples** : aller simple 10-7 → décidé immédiatement. Aller-retour 10-7 puis 5-8 → agrégat 15-15, **égalité**, 3e manche nécessaire. Aller-retour, 3e manche 6-4 → décision **uniquement** sur cette manche, pas d'addition avec les précédentes.

## 6. `handleLegCompleted()` — le cœur de l'orchestration

Appelée par `MatchesService.validateScore()` (voir [rbourdon.md §6.3](./rbourdon.md)) quand la manche validée appartient à un tournoi :

```ts
async handleLegCompleted(matchId: string): Promise<void> {
  const { tieId, tableId } = await this.findLegMeta(matchId);
  const tie = await this.tournamentsRepository.findTieById(tieId);
  if (tableId) await this.tablesService.releaseTournamentClaim(tableId, tieId); // 1. libère la table tout de suite

  // 2. enregistre le résultat de CETTE manche côté Gamification (voir bbouarab.md)

  const resolution = resolveTie(tie.tournament.twoLegged, tie.legs);
  if (!resolution.done) {
    await this.tournamentsRepository.markTieReady(tieId); // aller-retour pas fini : rejouable tout de suite
    await this.scheduleFreeTables(tie.tournamentId);
    return;
  }

  // 3. la rencontre EST décidée :
  const points = pointsForRound(tie.round);
  await this.tournamentsRepository.markTieDone(tieId, winnerEntry.id, points);
  await this.tournamentsRepository.awardRatingBonus(winnerIds, points); // ajoute les points au même Elo

  if (tie.round === tie.tournament.totalRounds) {
    // 4a. c'était la FINALE
    await this.tournamentsRepository.complete(tie.tournamentId);
    await this.badgesService.awardTournamentChampion(winnerIds); // badge + bonus XP
    this.tournamentsGateway.emitToUsers(allParticipantIds, 'tournament:completed', updated);
    return;
  }

  // 4b. il reste des tours : fait avancer le vainqueur dans la rencontre future
  const nextTieReady = await this.tournamentsRepository.advanceWinner(
    tie.tournamentId, tie.round + 1, Math.floor(tie.slot / 2),
    tie.slot % 2 === 0 ? 'A' : 'B', winnerEntry.id,
  );
  if (nextTieReady && nextRound === tie.tournament.totalRounds) {
    await this.badgesService.awardTournamentFinalists([...]); // les 2 finalistes sont maintenant connus
  }
  this.tournamentsGateway.emitToUsers(winnerIds, 'tournament:tieWon', {...});
  this.tournamentsGateway.emitToUsers(loserIds, 'tournament:eliminated', {...});
  await this.scheduleFreeTables(tie.tournamentId); // 5. relance l'ordonnanceur pour la suite
}
```
`Math.floor(tie.slot / 2)` + `tie.slot % 2 === 0 ? 'A' : 'B'` **mappe** deux rencontres d'un tour vers la bonne moitié de la rencontre du tour suivant : slots 0 et 1 convergent vers le slot 0 du tour suivant (0 devient l'entrée A, 1 devient B), slots 2 et 3 vers le slot 1, etc. — la structure classique d'un arbre binaire à plat.

`handleLegDisputed()` (manche en litige ou expirée) fait plus simple : libère la table, repasse la rencontre en `READY` sans toucher au score, relance l'ordonnanceur — **la manche est rejouée depuis zéro**, jamais de forfait.

## 7. `scheduleFreeTables()` — l'ordonnanceur

Appelée après **chaque** événement qui pourrait libérer une table ou rendre une rencontre jouable :

```ts
private async scheduleFreeTables(tournamentId: string): Promise<void> {
  const freeTableIds = await this.tablesService.listFreeUnclaimed(); // ordre aléatoire, voir rdinis.md
  const readyTies = await this.tournamentsRepository.findReadyTies(tournamentId);
  for (let i = 0; i < Math.min(freeTableIds.length, readyTies.length); i++) {
    const tableId = freeTableIds[i];
    const tie = await this.tournamentsRepository.findTieById(readyTies[i].id);
    const nextLegNumber = resolveTie(tournament.twoLegged, tie.legs).nextLegNumber ?? 1;
    const claimed = await this.tablesService.claimForTournament(tableId, tie.id); // atomique, voir rdinis.md
    if (!claimed) continue; // quelqu'un/quelque chose d'autre a pris la table entre-temps
    await this.tournamentsRepository.createLeg(tie.id, nextLegNumber, tournament.format, tableId, ...);
    this.tournamentsGateway.emitToUsers(participantIds, 'tournament:tieStarted', { tournamentId, tieId, tableId, legNumber });
  }
}
```
Boucle simple "table libre `i` ↔ rencontre prête `i`" — volontairement pas un algorithme d'optimisation : avec seulement 2 tables, un appariement dans l'ordre suffit, et l'ordre aléatoire de `listFreeUnclaimed()` garantit que ce n'est pas toujours "Baby A" qui est privilégiée.

## 8. API (`backend/src/tournaments/tournaments.controller.ts`)

| Route | Body | Rôle requis |
| --- | --- | --- |
| `GET /tournaments` | — | Connecté |
| `GET /tournaments/:id` | — | Connecté |
| `POST /tournaments` | `{ name, format, twoLegged, entries: [{player1Id, player2Id?}] }` | Admin |
| `POST /tournaments/:id/entries` | `{ player1Id, player2Id? }` | Admin |
| `DELETE /tournaments/:id/entries/:entryId` | — | Admin |
| `POST /tournaments/:id/launch` | — | Admin |
| `POST /tournaments/:id/cancel` | — | Admin |

## 9. Temps réel (`tournaments.gateway.ts`)

Namespace `/tournaments`. `tournament:created`/`tournament:updated` **diffusés à tout le monde** (liste `/tournaments`) ; `launched`, `tableReclaimed`, `tieStarted`, `tieWon`, `eliminated`, `completed` sont **ciblés** aux participants concernés.

## 10. Dépendances entre modules

`TournamentsModule` importe `TablesModule`, `QueueModule`, `BadgesModule` (**à sens unique** : Tournois → {Tables, Queue, Badges}) ; `MatchesModule` importe `TournamentsModule` (voir [rbourdon.md §6.3](./rbourdon.md)). Cycles cassés avec `forwardRef()` — voir [demane.md §8](./demane.md).

## 11. Frontend

`frontend/src/features/tournaments/` : `tournamentsApi.ts`, `tournamentsSocket.ts`, `TournamentsBootstrap.tsx` (toasts §9), `TieCard.tsx` (réutilise directement les mutations du module Match). Pages : `Tournaments.tsx` (liste + créer, admin), `TournamentNew.tsx` (formulaire + recherche de participants — **piège corrigé** : `useSearchUsersQuery` exclut l'utilisateur courant par design, donc l'admin ne pouvait pas s'auto-inscrire ; corrigé en injectant `useMeQuery()` dans les résultats), `TournamentDetail.tsx` (bracket par tour, score cumulé si aller-retour). `pages/Tables.tsx` affiche "Tournoi en cours" quand une table est réquisitionnée (voir [rdinis.md](./rdinis.md)).

## 12. Scénario complet, pas à pas (4 joueurs, aller simple)

1. Admin crée un tournoi 1v1, 4 joueurs (Alice, Bob, Charlie, Dan), aller simple. `totalRounds = 2`.
2. Lance : demi 1 = Alice vs Charlie (slot 0), demi 2 = Bob vs Dan (slot 1) ; finale `PENDING` déjà créée. Les 2 tables sont réquisitionnées : demi 1 sur Baby A, demi 2 sur Baby B, en **parallèle**.
3. Alice bat Charlie 10-6 sur Baby A → Baby A se libère, Alice reçoit 10 pts, devient l'entrée **A** de la finale. Bob vs Dan pas fini → pas encore de badge finaliste.
4. Bob bat Dan 10-8 sur Baby B → Bob reçoit 10 pts, devient l'entrée **B** de la finale. `advanceWinner()` renvoie `true` → Alice **et** Bob reçoivent `TOURNAMENT_FINALIST`. La finale est assignée à une table libre.
5. Alice bat Bob 10-9 en finale → 20 pts ajoutés à son Elo, `TOURNAMENT_CHAMPION` + bonus XP, tournoi `COMPLETED`, les 2 tables redeviennent utilisables normalement.

## 13. Erreurs possibles

| Exception | Quand |
| --- | --- |
| `BadRequestException` | Nombre d'entrées pas une puissance de 2 (ou < 4) ; format 2v2 sans `player2Id` (ou l'inverse) ; joueur en double |
| `ConflictException` | Lancer/modifier un tournoi qui n'est plus `DRAFT` |
| `NotFoundException` | Tournoi, entrée ou joueur inconnu |

## 14. Questions probables à la soutenance

- **"Comment les rencontres futures sont-elles créées avant même de connaître les joueurs ?"** → Des rencontres "coquilles" `PENDING` sans entrées sont créées dès le lancement pour tous les tours ≥ 2, remplies au fur et à mesure par `advanceWinner()`.
- **"Comment deux rencontres se jouent-elles en même temps ?"** → `scheduleFreeTables()` tourne après chaque événement pertinent et associe chaque table libre à une rencontre prête, sans notion de tour "bloquant".
- **"Pourquoi les points de tournoi ne sont-ils pas relatifs au classement ?"** → Une victoire de finale doit valoir plus qu'une victoire de premier tour peu importe qui affrontait qui — sinon un joueur pourrait "cibler" un adversaire faible, ce qui n'a pas de sens dans un tirage aléatoire.
- **"Litige en pleine finale ?"** → Manche rejouée automatiquement, table reste réquisitionnée, aucun forfait possible.
