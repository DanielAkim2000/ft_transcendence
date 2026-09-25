# `bbouarab` — Gamification (Badges & XP)

> Un fichier par membre de l'équipe dans `docs/team/`, chacun explique en profondeur — jusqu'au niveau du code — la partie qui lui revient. Les 5 fichiers mis bout à bout couvrent **tout** le projet : [`demane.md`](./demane.md) (socle), [`rdinis.md`](./rdinis.md) (Tables & Queue), [`rbourdon.md`](./rbourdon.md) (Match & Elo), [`vicli.md`](./vicli.md) (Tournois). Vision produit et règles métier globales : [`../PLAN.md`](../PLAN.md).

Ton module se branche sur [Match & Elo](./rbourdon.md) (chaque partie jouée) et [Tournois](./vicli.md) (bonus de fin de tournoi), sans jamais dépendre d'eux dans l'autre sens — c'est un module "feuille" (voir §6).

## 1. Le besoin, en une phrase

Le classement Elo (voir [rbourdon.md](./rbourdon.md)) sert déjà de "leaderboard". Ce module ajoute une couche de progression **indépendante du niveau de jeu** : un système d'XP/niveau qui grimpe même quand on perd, et une collection de 7 badges à débloquer, affichés sur chaque profil avec notification en temps réel.

## 2. Règles métier

- **XP**, séparé de l'Elo : **+10** à chaque match joué (`XP_PER_MATCH_PLAYED`, peu importe le résultat), **+20** de bonus en cas de victoire (`XP_PER_MATCH_WIN_BONUS`), **+50** de bonus pour avoir remporté un tournoi en entier (`XP_PER_TOURNAMENT_WIN_BONUS`, en plus des +10/+20 de chaque manche jouée dans ce tournoi).
- **Niveau = XP ÷ 100** (arrondi à l'entier inférieur, +1) : `levelForXp(xp) = Math.floor(xp / 100) + 1`. `xpIntoLevel(xp) = xp % 100` sert à dessiner la barre de progression.
- **7 badges**, chacun débloqué **une seule fois** (`@@unique([userId, code])` sur `UserBadge`) :

| Code | Condition | Déclenché depuis |
| --- | --- | --- |
| `FIRST_WIN` | 1ère victoire | Chaque match/manche gagné (`checkMilestones`) |
| `TEN_WINS` | 10 victoires | idem |
| `FIFTY_MATCHES` | 50 matchs joués (gagnés ou perdus) | idem |
| `WIN_STREAK_3` | 3 victoires d'affilée | idem |
| `GIANT_SLAYER` ("tombeur") | Battre un adversaire avec **150+ points d'Elo d'avance** (`GIANT_SLAYER_RATING_GAP`) | **Uniquement** le classement libre — jamais les tournois, qui ne sont pas relatifs au rang |
| `TOURNAMENT_FINALIST` | Atteindre la finale d'un tournoi | [vicli.md](./vicli.md), quand les 2 finalistes sont connus |
| `TOURNAMENT_CHAMPION` | Remporter un tournoi (+ bonus XP) | [vicli.md](./vicli.md), à la fin de la finale |

## 3. Modèle de données

Sur `User` : `xp`, `wins`, `currentWinStreak`, `bestWinStreak` (en plus de `rating`/`matchesPlayed` utilisés par l'Elo, voir [rbourdon.md](./rbourdon.md)). `UserBadge` : `userId` + `code` (`@@unique`). Le **catalogue des badges** n'est **pas** en base : liste statique dans le code — `backend/src/badges/entities/badge.entity.ts` (énumération `BadgeCode`) côté serveur, `frontend/src/features/badges/badgeCatalog.ts` (icône lucide + clé i18n) côté client. Plus simple à faire évoluer qu'une table de référence pour 7 entrées fixes.

## 4. API

Une seule route, volontairement **publique à tout utilisateur connecté** (pas seulement le sien) : `GET /badges/:userId` →
```json
{
  "userId": "clx123", "xp": 145, "level": 2, "xpIntoLevel": 45, "xpPerLevel": 100,
  "wins": 6, "matchesPlayed": 11, "currentWinStreak": 2, "bestWinStreak": 4,
  "badges": [
    { "code": "FIRST_WIN", "earnedAt": "2026-09-20T10:00:00.000Z" },
    { "code": "GIANT_SLAYER", "earnedAt": "2026-09-21T14:32:00.000Z" }
  ]
}
```

## 5. Backend — comment ça marche vraiment

Dossier `backend/src/badges/` : `badges.controller.ts` → `services/badges.service.ts` → `repositories/badges.repository.ts`, plus `badges.gateway.ts`.

### 5.1 Enregistrer un résultat — pourquoi lecture puis écriture pour la série

```ts
async recordWin(userId: string): Promise<void> {
  const user = await this.prisma.user.findUniqueOrThrow({
    where: { id: userId }, select: { currentWinStreak: true, bestWinStreak: true },
  });
  const nextStreak = user.currentWinStreak + 1;
  await this.prisma.user.update({
    where: { id: userId },
    data: {
      matchesPlayed: { increment: 1 }, wins: { increment: 1 },
      xp: { increment: XP_PER_MATCH_PLAYED + XP_PER_MATCH_WIN_BONUS }, // 10 + 20 = 30
      currentWinStreak: nextStreak,
      bestWinStreak: Math.max(nextStreak, user.bestWinStreak), // "garder le max" n'est pas exprimable en un seul UPDATE atomique
    },
  });
}

async recordLoss(userId: string): Promise<void> {
  await this.prisma.user.update({
    where: { id: userId },
    data: { matchesPlayed: { increment: 1 }, xp: { increment: XP_PER_MATCH_PLAYED }, currentWinStreak: 0 },
  });
}
```
Prisma sait faire `increment` en une seule requête atomique, mais pas "mettre à jour au maximum entre la valeur actuelle et une nouvelle" — d'où la lecture avant écriture, uniquement pour `recordWin` (`recordLoss`/`recordDraw` remettent toujours la série à 0, pas besoin de lire avant).

### 5.2 Attribuer un badge sans race condition

```ts
/** Retourne true si le badge vient d'être débloqué (false s'il l'était déjà). */
async award(userId: string, code: BadgeCode): Promise<boolean> {
  try {
    await this.prisma.userBadge.create({ data: { userId, code } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false; // déjà obtenu
    throw error;
  }
}
```
Une approche naïve ("vérifier si le badge existe, sinon le créer") ferait **2 requêtes** avec une fenêtre de race condition entre les deux. Ici, on tente directement la création et on **laisse la contrainte unique de la base trancher** — une seule requête, jamais de doublon même si deux requêtes concurrentes attribuent le même badge à la même milliseconde.

### 5.3 Le point d'entrée principal : `recordGameResult()`

```ts
async recordGameResult(input: GameResultInput): Promise<void> {
  for (const id of input.winnerIds) await this.badgesRepository.recordWin(id);
  for (const id of input.loserIds) await this.badgesRepository.recordLoss(id);
  for (const id of [...input.winnerIds, ...input.loserIds]) await this.checkMilestones(id);

  if (input.checkGiantSlayer && input.loserAvgRatingBefore! - input.winnerAvgRatingBefore! >= GIANT_SLAYER_RATING_GAP) {
    for (const id of input.winnerIds) await this.tryAward(id, BadgeCode.GIANT_SLAYER);
  }
}

private async checkMilestones(userId: string): Promise<void> {
  const stats = await this.badgesRepository.getStats(userId);
  if (stats.wins >= 1) await this.tryAward(userId, BadgeCode.FIRST_WIN);
  if (stats.wins >= 10) await this.tryAward(userId, BadgeCode.TEN_WINS);
  if (stats.matchesPlayed >= 50) await this.tryAward(userId, BadgeCode.FIFTY_MATCHES);
  if (stats.currentWinStreak >= 3) await this.tryAward(userId, BadgeCode.WIN_STREAK_3);
}

private async tryAward(userId: string, code: BadgeCode): Promise<void> {
  if (await this.badgesRepository.award(userId, code)) {
    this.badgesGateway.emitToUser(userId, 'badges:earned', { code }); // notifie seulement si VRAIMENT nouveau
  }
}
```
`checkMilestones` revérifie **tous** les seuils à chaque match, pas seulement celui franchi cette fois — `award()` étant idempotent (§5.2), ré-attribuer un badge déjà obtenu ne fait rien et ne notifie pas deux fois.

Appelée par `MatchesService.applyElo()` (voir [rbourdon.md §6.4](./rbourdon.md)) à chaque match du classement complété, avec `checkGiantSlayer: true`. Appelée aussi par `TournamentsService.handleLegCompleted()` (voir [vicli.md](./vicli.md)) pour chaque manche de tournoi, mais **sans** `checkGiantSlayer` (les tournois ne sont pas relatifs au rang).

### 5.4 Les bonus de tournoi

```ts
async awardTournamentFinalists(userIds: string[]): Promise<void> {
  for (const id of userIds) await this.tryAward(id, BadgeCode.TOURNAMENT_FINALIST);
}

async awardTournamentChampion(userIds: string[]): Promise<void> {
  for (const id of userIds) {
    await this.badgesRepository.addBonusXp(id, XP_PER_TOURNAMENT_WIN_BONUS); // +50, en plus du XP déjà gagné manche par manche
    await this.tryAward(id, BadgeCode.TOURNAMENT_CHAMPION);
  }
}
```

## 6. Pourquoi ce module n'importe aucun autre module métier

`BadgesModule` n'importe que `PrismaModule` et exporte `BadgesService` — c'est [Match](./rbourdon.md) et [Tournois](./vicli.md) qui **en dépendent**, jamais l'inverse. Un module "feuille" comme celui-ci ne peut jamais être à l'origine d'un cycle de dépendances NestJS, ce qui simplifie beaucoup son intégration : pas de `forwardRef()` nécessaire ici (contrairement à presque tous les autres modules, voir [demane.md](./demane.md)).

## 7. Le piège historique corrigé (double comptage)

`matchesPlayed` était incrémenté à **deux endroits** : dans la logique Elo d'origine (`MatchesRepository.applyEloUpdates()`) et ici (`recordWin`/`recordLoss`). Un joueur validant un match voyait son compteur augmenter de **+2**. Corrigé en retirant l'incrément côté Elo — **Badges est l'unique responsable** de ce compteur. Voir [rbourdon.md §7](./rbourdon.md) pour le détail côté Match.

## 8. Temps réel (`badges.gateway.ts`)

Namespace `/badges`, événement `badges:earned` envoyé **au joueur concerné uniquement** avec `{ code }`.

## 9. Frontend

Dossier `frontend/src/features/badges/` : `badgesApi.ts` (`useGetBadgesQuery(userId)`), `badgeCatalog.ts`, `badgesSocket.ts` / `BadgesBootstrap.tsx` (écoute `badges:earned`, invalide le cache **de son propre profil uniquement**, toast), `PlayerBadgesCard.tsx` — la carte "Progression" : barre XP/niveau, stats, grille des 7 badges (coloré si obtenu, grisé + cadenas sinon, nom/description toujours visibles via tooltip). Montée sur `pages/Profile.tsx` **et** `pages/ProfileMe.tsx`.

## 10. Scénario complet, pas à pas — exemple chiffré

Un compte tout neuf (0 XP, niveau 1) :
1. Gagne son 1er match (10 + 20 = **+30 XP** → 30 XP, niveau 1) → `wins = 1` → badge `FIRST_WIN`, toast + carte mise à jour en direct.
2. Gagne 2 matchs de plus d'affilée (série de 3) → badge `WIN_STREAK_3`. XP total : 90.
3. Un 4e match gagné → 120 XP → **niveau 2** (`120/100 → +1`), `xpIntoLevel = 20`.
4. Bat un adversaire à 1250 alors que le sien est à 1080 (écart 170 ≥ 150) → `GIANT_SLAYER`.
5. Atteint puis gagne une finale de tournoi → `TOURNAMENT_FINALIST` puis `TOURNAMENT_CHAMPION` + 50 XP bonus.

## 11. Questions probables à la soutenance

- **"Pourquoi l'XP est-il séparé de l'Elo ?"** → L'Elo mesure le **niveau relatif** (peut descendre), l'XP mesure l'**investissement/l'assiduité** (ne descend jamais, monte même en cas de défaite).
- **"Comment évitez-vous qu'un badge soit débloqué deux fois ?"** → Contrainte unique en base + `award()` qui tente directement la création et interprète l'erreur `P2002` comme "déjà obtenu" plutôt qu'une vérification préalable séparée (§5.2).
- **"Pourquoi le badge tombeur ne se déclenche-t-il pas dans les tournois ?"** → Cohérent avec la règle métier des tournois (points fixes par tour, pas relatifs au classement).
- **"Le calcul de niveau, c'est quoi exactement ?"** → `Math.floor(xp / 100) + 1`, fonction pure testée isolément (`backend/src/badges/lib/xp.ts`).
