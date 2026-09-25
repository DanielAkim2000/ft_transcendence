# `rbourdon` — Match (défi) & Elo

> Un fichier par membre de l'équipe dans `docs/team/`, chacun explique en profondeur — jusqu'au niveau du code — la partie qui lui revient. Les 5 fichiers mis bout à bout couvrent **tout** le projet : [`demane.md`](./demane.md) (socle), [`rdinis.md`](./rdinis.md) (Tables & Queue), [`vicli.md`](./vicli.md) (Tournois), [`bbouarab.md`](./bbouarab.md) (Gamification). Vision produit et règles métier globales : [`../PLAN.md`](../PLAN.md).

Ta slice est réutilisée **telle quelle** par le module [Tournois](./vicli.md) pour jouer chaque manche — comprends-la bien, elle sert deux fois.

## 1. Le besoin, en une phrase

Deux mécaniques indépendantes de l'occupation des tables (voir [rdinis.md](./rdinis.md)) : (1) un **classement** de tous les joueurs, (2) un système de **défi** entre joueurs pour faire évoluer ce classement. On peut défier quelqu'un sans jamais toucher à une table physique — le match est juste une déclaration de score entre joueurs, validée par l'adversaire.

## 2. Règles métier

1. Défi lancé **depuis le classement** (`/ranking`), en **1v1 ou 2v2**, au choix du proposeur.
2. **2v2** : chaque camp choisit **son propre coéquipier** — le proposeur au moment de la création, le défié au moment d'accepter.
3. Un joueur ne peut pas se choisir lui-même comme coéquipier, ni choisir un joueur déjà dans l'équipe adverse. Le défié, en plus, ne peut pas reprendre le coéquipier **déjà choisi par le proposeur**.
4. N'importe quel joueur du match peut **soumettre le score** ; il faut la validation d'**un joueur de l'équipe adverse** pour que le résultat compte.
5. Si personne ne valide sous **10 minutes** (`SCORE_VALIDATION_TIMEOUT_MS`), le match passe en **litige** (`DISPUTED`) automatiquement : pas d'Elo appliqué.
6. **Elo** : calcul **serveur uniquement**, appliqué à la validation. Rating de départ **1000**. Battre un adversaire mieux classé rapporte mécaniquement plus de points que l'inverse — propriété de la formule (§5), pas une règle codée à part.

## 3. Machine à états d'un match

```
PENDING ──accept──▶ ACCEPTED ──score soumis──▶ PENDING_VALIDATION ──validé──▶ COMPLETED
   │                                                   │
 decline                                          refusé / 10 min
   ▼                                                   ▼
DECLINED                                           DISPUTED
```

## 4. Modèle de données

`Match` : `format` (`ONE_V_ONE`/`TWO_V_TWO`), `status`, `teamA`/`teamB` (1 ou 2 joueurs), `scoreA`/`scoreB`, `submittedBy`, `validatedBy`, `respondedAt`, `submittedAt`, `validationExpiresAt`. Si c'est une **manche de tournoi** : `tournamentTieId` + `legNumber` non nuls (voir [vicli.md](./vicli.md) — bifurque la logique à la validation, §6.4).

`User.rating` (Elo, défaut 1000). **Attention** : `matchesPlayed`/`wins`/séries ne sont **pas** gérés ici mais par [bbouarab.md](./bbouarab.md) — voir l'encadré §7.

## 5. La formule Elo, expliquée avec un exemple chiffré

Fichier pur, testable isolément : `backend/src/matches/lib/elo.ts`.

```ts
const NEW_PLAYER_MATCH_THRESHOLD = 10;
const K_NEW_PLAYER = 40;
const K_ESTABLISHED = 20;

function expectedScore(teamRating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - teamRating) / 400));
}
```
`ratingAfter = ratingBefore + K × (outcome − expected)`, où `outcome` vaut 1/0/0.5, `K` = 40 pour un joueur avec moins de 10 matchs joués, 20 ensuite.

**Exemple** : Alice (1000, établie) bat Bob (1200, établi) en 1v1.
- `expected pour Alice ≈ 0.24` (donnée gagnante à 24%).
- `outcome = 1` → `ratingAfter = 1000 + 20 × (1 − 0.24) ≈ 1015`.
- Bob (favori qui perd) : `expected ≈ 0.76`, `outcome = 0` → `ratingAfter ≈ 1185`.

Alice gagne **+15**, Bob perd **-15** : battre un adversaire largement mieux classé rapporte mécaniquement plus — sans règle spécifique codée, c'est ce que produit la formule quand `expected` est loin de 0.5.

En **2v2**, `teamA`/`teamB` sont réduits à la **moyenne** des ratings, puis **le même delta** s'applique aux deux coéquipiers.

## 6. API & backend — comment ça marche vraiment

Dossier `backend/src/matches/` : `matches.controller.ts` → `services/matches.service.ts` → `repositories/matches.repository.ts`, plus `matches.gateway.ts`.

| Route | Body | Description |
| --- | --- | --- |
| `GET /matches/me` | — | Mes matchs (ladder uniquement, pas les manches de tournoi) |
| `GET /matches/:matchId` | — | Détail d'un match |
| `POST /matches` | `{ opponentId, format, teammateId? }` | Proposer un défi |
| `POST /matches/:matchId/respond` | `{ accept, teammateId? }` | Accepter/refuser, choisir son coéquipier si 2v2 |
| `POST /matches/:matchId/score` | `{ scoreA, scoreB }` | Soumettre un score |
| `POST /matches/:matchId/validate` | `{ accept }` | Valider ou contester |

### 6.1 Proposer un défi

```ts
async propose(challengerId, opponentId, format, teammateId?) {
  if (opponentId === challengerId) throw new BadRequestException('You cannot challenge yourself');
  if (!(await this.usersService.findUserById(opponentId))) throw new NotFoundException('Opponent not found');
  if (format === MatchFormat.TWO_V_TWO) {
    if (!teammateId) throw new BadRequestException('teammateId is required for 2v2');
    if (teammateId === challengerId || teammateId === opponentId) throw new BadRequestException('Invalid teammate');
  }
  const match = await this.matchesRepository.create(format, challengerId, opponentId, teammateId);
  this.matchesGateway.emitToUser(opponentId, 'match:proposed', match);
  return match;
}
```

### 6.2 Répondre — le bug de sélection de coéquipier corrigé ici

```ts
async respond(userId, matchId, accept, teammateId?) {
  const match = await this.getMatch(matchId);
  if (match.status !== MatchStatus.PENDING) throw new ConflictException('This challenge is no longer pending');
  if (match.teamB[0]?.id !== userId) throw new ForbiddenException('Only the challenged player can respond');
  if (!accept) { /* ... DECLINED ... */ }
  if (match.format === MatchFormat.TWO_V_TWO) {
    if (!teammateId) throw new BadRequestException('teammateId is required for 2v2');
    if (
      teammateId === userId ||
      match.teamA.some((player) => player.id === teammateId) // ← exclut TOUTE l'équipe adverse
    ) {
      throw new BadRequestException('Invalid teammate');
    }
  }
  // ...
}
```
**Bug historique corrigé** : avant, seul `match.teamA[0]?.id` (le proposeur) était exclu — si le proposeur avait déjà choisi un coéquipier, ce coéquipier restait proposable au défié, qui pouvait donc "voler" le partenaire de son adversaire. `match.teamA.some(...)` exclut **toute** l'équipe adverse. Le frontend applique le même filtre en plus, mais la vérification qui compte est celle du serveur.

### 6.3 Soumettre et valider un score

```ts
async submitScore(userId, matchId, scoreA, scoreB) {
  const match = await this.getMatch(matchId);
  this.assertParticipant(match, userId); // n'importe quel des 2-4 joueurs peut soumettre
  if (match.status !== MatchStatus.ACCEPTED) throw new ConflictException('Match is not ready for a score');
  const validationExpiresAt = new Date(Date.now() + SCORE_VALIDATION_TIMEOUT_MS); // 10 min
  // ... écrit le score, passe en PENDING_VALIDATION, programme un setTimeout de 10 min
}

async validateScore(userId, matchId, accept) {
  const match = await this.getMatch(matchId);
  this.assertParticipant(match, userId);
  if (match.status !== MatchStatus.PENDING_VALIDATION) throw new ConflictException('No score awaiting validation');
  const submitterTeam = this.teamOf(match, match.submittedBy?.id ?? '');
  const validatorTeam = this.teamOf(match, userId);
  if (!submitterTeam || !validatorTeam || submitterTeam === validatorTeam) {
    throw new ForbiddenException('Only the other team can validate this score'); // ← un coéquipier ne peut pas s'auto-valider
  }
  if (!accept) { /* → DISPUTED, éventuellement handleLegDisputed() si manche de tournoi */ }
  if (match.tournamentTieId) {
    await this.tournamentsService.handleLegCompleted(matchId); // bifurque vers le moteur de tournoi
  } else {
    await this.applyElo(matchId, match); // chemin normal du classement libre
  }
}
```
Si personne ne valide dans les 10 minutes, le `setTimeout` déclenche `handleValidationExpiry()`, qui fait exactement la même chose qu'un refus explicite.

### 6.4 `applyElo()` — le point de jonction avec la Gamification

```ts
private async applyElo(matchId, match): Promise<void> {
  const teams = await this.matchesRepository.getTeamsForElo(matchId);
  const outcomeForTeamA = match.scoreA === match.scoreB ? 0.5 : match.scoreA > match.scoreB ? 1 : 0;
  const results = computeEloUpdates(teams.teamA, teams.teamB, outcomeForTeamA);
  await this.matchesRepository.applyEloUpdates(results);

  if (outcomeForTeamA === 0.5) {
    await this.badgesService.recordDraw([...teams.teamA, ...teams.teamB].map((p) => p.id));
  } else {
    const [winners, losers] = outcomeForTeamA === 1 ? [teams.teamA, teams.teamB] : [teams.teamB, teams.teamA];
    await this.badgesService.recordGameResult({
      winnerIds: winners.map((p) => p.id), loserIds: losers.map((p) => p.id),
      checkGiantSlayer: true, // seul le classement libre déclenche le badge "tombeur", pas les tournois
      winnerAvgRatingBefore: average(winners), loserAvgRatingBefore: average(losers),
    });
  }
}
```
Voir [bbouarab.md](./bbouarab.md) pour ce que fait `recordGameResult`/`recordDraw` derrière ce point d'entrée.

## 7. Le piège historique : double comptage de `matchesPlayed`

`matchesPlayed` était incrémenté à **deux endroits** : dans `MatchesRepository.applyEloUpdates()` (logique Elo d'origine) et dans le module Gamification (arrivé plus tard). Un joueur validant un match voyait son compteur augmenter de **+2**. Corrigé en retirant l'incrément côté Elo — **Badges est désormais l'unique responsable** de ce compteur. Bon réflexe : un compteur ne doit avoir qu'un seul "propriétaire".

## 8. Temps réel (`matches.gateway.ts`)

Namespace `/matches`. Tous les événements sont **ciblés** : `match:proposed`, `match:responded`, `match:scoreSubmitted`, `match:completed`, `match:disputed`.

## 9. Frontend

`frontend/src/features/matches/` : RTK Query + socket + bootstrap. Le défi se lance depuis **`pages/Ranking.tsx`** : bouton "Défier", sélecteur 1v1/2v2, et pour le 2v2 un sélecteur de coéquipier filtré côté frontend **en plus** de la validation serveur du §6.2.

## 10. Scénario complet, pas à pas

1. Alice défie Bob en 2v2, choisit Charlie comme coéquipier → `PENDING`, Bob reçoit `match:proposed`.
2. Bob accepte, choisit Dan → le serveur vérifie que Dan n'est ni Bob, ni Alice, ni Charlie → `ACCEPTED`.
3. Alice soumet le score `10-7` → `PENDING_VALIDATION`, minuteur de 10 min.
4. Bob ou Dan valide → `applyElo()` recalcule les 4 ratings (même delta pour Alice/Charlie, inverse pour Bob/Dan), `COMPLETED`, tout le monde reçoit `match:completed`.

## 11. Questions probables à la soutenance

- **"Pourquoi le K-factor est plus élevé pour les nouveaux joueurs ?"** → Pour converger plus vite vers leur vrai niveau au lieu de rester bloqués près de 1000.
- **"Qui peut valider un score ?"** → Uniquement un joueur de l'équipe **adverse** — un coéquipier ne peut pas auto-valider.
- **"Litige, ça donne quoi ?"** → Aucun changement d'Elo. Manche de tournoi → rejouée automatiquement (voir [vicli.md](./vicli.md)) ; classement libre → reste `DISPUTED` dans l'historique.
- **"Un match de tournoi, c'est quoi de plus qu'un match normal ?"** → Rien structurellement : un `Match` comme un autre, seule différence `tournamentTieId` non nul, qui fait bifurquer `validateScore()` vers `TournamentsService`. Tout le flux de saisie/validation est réutilisé à 100%.
