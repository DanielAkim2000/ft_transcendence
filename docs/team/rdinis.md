# `rdinis` — Tables & Queue

> Un fichier par membre de l'équipe dans `docs/team/`, chacun explique en profondeur — jusqu'au niveau du code — la partie qui lui revient. Les 5 fichiers mis bout à bout couvrent **tout** le projet : [`demane.md`](./demane.md) (socle : auth, utilisateurs, présence, chat, i18n/thème, infra, design system), [`rbourdon.md`](./rbourdon.md) (Match & Elo), [`vicli.md`](./vicli.md) (Tournois), [`bbouarab.md`](./bbouarab.md) (Gamification). Vision produit et règles métier globales : [`../PLAN.md`](../PLAN.md).

Ta slice regroupe les **deux premières briques du produit**, étroitement liées : savoir si une table est libre, et faire la queue quand elle ne l'est pas. Le module [Match & Elo](./rbourdon.md) et les [Tournois](./vicli.md) s'appuient dessus — comprends-les bien, tout le reste en dépend.

---

# Partie 1 — Tables

## 1. Le besoin, en une phrase

Le babyfoot est **physique** : il n'y a aucun capteur. L'app ne fait qu'un miroir déclaratif ("honor system") de l'état réel des 2 tables de 42 Paris (Baby A / Baby B) : libre ou occupée, par qui, depuis quand.

## 2. Règles métier

1. 2 tables fixes, créées au démarrage par le seed (`backend/prisma/seed.ts`) : `Baby A`, `Baby B`.
2. Un joueur clique "Occuper" quand il commence à jouer, "Libérer" quand il a fini. **Aucune vérification physique** — choix de scope assumé (pas d'IoT), pas un oubli.
3. On ne peut **pas** occuper une table déjà occupée. Protection **côté serveur**, pas seulement en désactivant le bouton côté client.
4. Une table peut être **réservée par un tournoi** (`currentTournamentTieId` non nul, voir [vicli.md](./vicli.md)) : dans ce cas, occuper/libérer manuellement est bloqué, la table affiche la rencontre en cours à la place.
5. Toute la page vit en **temps réel** (WebSocket, pas de polling).
6. Contrainte supplémentaire en base (index unique partiel écrit à la main) : **un utilisateur ne peut occuper qu'une seule table à la fois**.

## 3. Modèle de données

Modèle `Table` :

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | `String` (cuid) | Identifiant |
| `name` | `String` | `Baby A`, `Baby B` |
| `status` | `TableStatus` (`FREE`\|`BUSY`) | État courant |
| `occupiedById` | `String?` | Qui occupe |
| `occupiedAt` | `DateTime?` | Depuis quand |
| `currentTournamentTieId` | `String?` **unique** | Non nul si réquisitionnée par un tournoi |

## 4. API (`backend/src/tables/tables.controller.ts`)

| Route | Description |
| --- | --- |
| `GET /tables` | Liste des 2 tables avec occupant et, le cas échéant, la rencontre de tournoi en cours |
| `POST /tables/:tableId/occupy` | Occuper une table |
| `POST /tables/:tableId/release` | Libérer une table |

Exemple de `currentTournamentTie` dans la réponse :
```json
{ "id": "tie_123", "tournamentId": "tour_456", "tournamentName": "Coupe de printemps",
  "round": 2, "roundLabel": "SEMI", "entryALabel": "Alice + Bob", "entryBLabel": "Charlie" }
```

## 5. Backend — comment ça marche vraiment

Dossier `backend/src/tables/` : `tables.controller.ts` → `services/tables.service.ts` → `repositories/tables.repository.ts`, plus `tables.gateway.ts`.

### 5.1 Le point technique le plus important : éviter la race condition

Deux joueurs cliquent "Occuper" à la même milliseconde. Avec un `findUnique` + `update` classique, les deux pourraient lire "libre" avant que l'un des deux n'écrive. La solution : un **`updateMany` avec le statut attendu dans le `WHERE`**, et on vérifie le nombre de lignes réellement modifiées :

```ts
// backend/src/tables/repositories/tables.repository.ts
async occupy(id: string, userId: string): Promise<boolean> {
  const { count } = await this.prisma.table.updateMany({
    where: { id, status: TableStatus.FREE, currentTournamentTieId: null },
    data: { status: TableStatus.BUSY, occupiedAt: new Date(), occupiedById: userId },
  });
  return count === 1; // 0 = quelqu'un d'autre a été plus rapide (ou table réservée)
}
```
PostgreSQL garantit qu'un `UPDATE` avec conditions est **atomique** : une seule des deux requêtes concurrentes affectera `count = 1`, l'autre recevra `count = 0`. Le service traduit ça en erreur métier :

```ts
// backend/src/tables/services/tables.service.ts
async occupy(userId: string, tableId: string): Promise<TableEntity> {
  const table = await this.getTable(tableId);
  if (table.currentTournamentTie) throw new ConflictException('Table reserved for an ongoing tournament');
  const reservation = await this.queueService.getActiveReservation(tableId);
  if (reservation && reservation.requester.id !== userId) {
    throw new ConflictException('Table reserved for the next player in the queue');
  }
  if (!(await this.tablesRepository.occupy(tableId, userId))) {
    throw new ConflictException('Table already occupied');
  }
  await this.queueService.onTableOccupied(tableId, userId); // fait avancer la queue si besoin
  return this.publish(tableId); // diffuse la mise à jour en WebSocket
}
```
Trois raisons de refus, dans l'ordre vérifié : (1) réservée par un tournoi, (2) c'est le tour de quelqu'un d'autre dans la file, (3) quelqu'un a occupé la table entre-temps. Si l'utilisateur occupe déjà une **autre** table, la contrainte unique partielle renvoie une erreur Prisma `P2002`, traduite en `ConflictException`.

### 5.2 Libération, libération forcée, réquisition par un tournoi

- `release()` — même logique atomique, vérifie en plus que c'est bien l'occupant (`ForbiddenException` sinon). Appelle ensuite `queueService.onTableFreed()`.
- `forceRelease()` — utilisé par le module [Tournois](./vicli.md) au lancement : coupe l'occupation **quel que soit l'occupant**, renvoie son id pour notification.
- `claimForTournament()` / `releaseTournamentClaim()` — même principe atomique, mais posent/retirent `currentTournamentTieId`.
- `listFreeUnclaimed()` — tables libres et non réquisitionnées, **dans un ordre aléatoire** (Fisher-Yates) : c'est ce qui fait qu'un tournoi assigne Baby A ou Baby B au hasard.

### 5.3 Temps réel (`tables.gateway.ts`)

Namespace `/tables`. À chaque changement, `publish(tableId)` recharge la table et l'envoie via `emitTableUpdate(table)` — **diffusé à tout le monde** (pas ciblé, contrairement à la Queue), l'état des tables étant une information publique.

## 6. Frontend

`frontend/src/features/tables/` : `tablesApi.ts` (RTK Query), `tablesSocket.ts`, `TablesBootstrap.tsx` (écoute `table:updated`, patch direct du cache). `pages/Tables.tsx` : carte libre (bouton Occuper) / occupée par moi (bouton Libérer) / occupée par un autre (bouton Rejoindre la file) / réquisitionnée par un tournoi (carte spéciale, pas de bouton).

## 7. Scénario complet, pas à pas

1. Alice et Bob sont sur `/tables`, connectés en WebSocket.
2. Alice occupe Baby A → `TablesService.occupy()` réussit → `table:updated` diffusé à tout le monde.
3. Bob voit sa carte Baby A passer instantanément à "occupée par Alice", avec un bouton "Rejoindre la file".
4. Alice libère → `queueService.onTableFreed()` fait avancer la file s'il y a quelqu'un (voir Partie 2).

## 8. Erreurs possibles

| Exception | Quand |
| --- | --- |
| `NotFoundException` | `tableId` inconnu |
| `ConflictException` | Réquisitionnée par un tournoi / réservée pour le prochain de la queue / déjà occupée (race) / tu occupes déjà une autre table |
| `ConflictException` | Table déjà libre (à la libération) |
| `ForbiddenException` | Tu ne l'occupes pas (à la libération) |

---

# Partie 2 — Queue

## 1. Le besoin, en une phrase

Quand une table est occupée, les joueurs suivants doivent pouvoir s'inscrire pour jouer ensuite, **dans l'ordre d'arrivée** (FIFO), sans rester planté devant le babyfoot. La queue **ne dit pas qui joue avec qui** : ça se décide séparément via un [Match](./rbourdon.md).

## 2. Règles métier

1. Une entrée = **un seul nom**. File **FIFO** par table.
2. Impossible de rejoindre la file d'une table **libre** (occupe-la directement) ou **réquisitionnée par un tournoi**.
3. Impossible d'avoir **deux entrées actives** en même temps, même sur des tables différentes (contrainte unique partielle en base).
4. Table libérée → le prochain est **appelé** (`CALLED`), **2 minutes** pour occuper. Passé le délai, il **expire** (`EXPIRED`), le suivant est appelé automatiquement — en cascade.
5. Un tournoi qui démarre **vide de force** les files des deux tables.

## 3. Machine à états

```
WAITING ──(ton tour)──▶ CALLED ──(occupé à temps)──▶ DONE
   │                        │
 annulation           2 min sans occuper
   ▼                        ▼
CANCELLED                EXPIRED
```

## 4. Modèle de données

`QueueEntry` : `tableId`, `requesterId`, `status`, `joinedAt`, `calledAt`, `expiresAt`. La **position** n'est pas stockée, recalculée à chaque lecture :
```ts
private async computePosition(tableId: string, joinedAt: Date): Promise<number> {
  return this.prisma.queueEntry.count({
    where: { tableId, status: { in: ACTIVE_STATUSES }, joinedAt: { lte: joinedAt } },
  });
}
```

## 5. API (`backend/src/queue/queue.controller.ts`)

| Route | Description |
| --- | --- |
| `GET /queue/me` | Mon entrée active, ou `null` |
| `GET /queue/:tableId` | File complète d'une table |
| `POST /queue/:tableId/join` | Rejoindre |
| `DELETE /queue/:entryId` | Annuler |

## 6. Backend — comment ça marche vraiment

`QUEUE_TIMEOUT_MS = 2 * 60 * 1000`.

### 6.1 Rejoindre — les 3 vérifications

```ts
async join(userId: string, tableId: string): Promise<QueueEntryEntity> {
  const table = await this.queueRepository.getTableStatus(tableId);
  if (table.claimedByTournament) throw new ConflictException('Table reserved for an ongoing tournament');
  const hasActiveQueue = await this.queueRepository.hasActiveQueue(tableId);
  if (table.status === 'FREE' && !hasActiveQueue) throw new ConflictException('Table is free, take it directly');
  if (await this.queueRepository.findActiveForUser(userId)) throw new ConflictException('You are already in a queue');
  // ... création
}
```
Si la table est libre **mais** que quelqu'un vient d'être appelé et n'a pas encore occupé, rejoindre reste autorisé.

### 6.2 Faire avancer la file

```ts
async onTableOccupied(tableId, userId): Promise<void> {
  const called = await this.queueRepository.findActiveCalledForTable(tableId);
  if (!called || called.requester.id !== userId) return;
  if (await this.queueRepository.markDone(called.id)) { this.clearTimer(called.id); await this.publish(tableId); }
}

onTableFreed(tableId): Promise<void> { return this.advanceQueue(tableId); }

private async advanceQueue(tableId): Promise<void> {
  const table = await this.queueRepository.getTableStatus(tableId);
  if (!table || table.status !== 'FREE' || table.claimedByTournament) return;
  if (await this.queueRepository.findActiveCalledForTable(tableId)) return;
  const next = await this.queueRepository.findNextWaiting(tableId);
  if (!next) return;
  const expiresAt = new Date(Date.now() + QUEUE_TIMEOUT_MS);
  if (!(await this.queueRepository.markCalled(next.id, expiresAt))) return;
  this.scheduleExpiry(next.id, tableId);
  this.queueGateway.emitToUser(next.requester.id, 'queue:called', { tableId, expiresAt });
  await this.publish(tableId);
}
```
Et le minuteur (vrai `setTimeout()`, `Map<entryId, Timeout>`) :
```ts
private async handleExpiry(entryId, tableId): Promise<void> {
  this.timers.delete(entryId);
  const entry = await this.queueRepository.findById(entryId);
  if (!(await this.queueRepository.markExpired(entryId))) return;
  if (entry) this.queueGateway.emitToUser(entry.requester.id, 'queue:expired', { tableId });
  await this.advanceQueue(tableId); // appelle le suivant automatiquement, en cascade
}
```

### 6.3 Réquisition par un tournoi

```ts
async clearForTable(tableId): Promise<void> {
  const entries = await this.queueRepository.cancelAllForTable(tableId);
  for (const entry of entries) {
    this.clearTimer(entry.id);
    this.queueGateway.emitToUser(entry.requester.id, 'queue:expired', { tableId, reason: 'tournament' });
  }
  if (entries.length > 0) await this.publish(tableId);
}
```
Appelée par `TournamentsService.launch()` sur les deux tables (voir [vicli.md](./vicli.md)).

### 6.4 Temps réel (`queue.gateway.ts`)

Namespace `/queue`. Contrairement aux Tables (broadcast), `queue:called`/`queue:expired` sont **ciblés au joueur concerné** (`server.to(userId).emit(...)`).

## 7. Frontend

`frontend/src/features/queue/` : `queueApi.ts`, `queueSocket.ts` / `QueueBootstrap.tsx` (toast "à toi de jouer !" + point de notification sur "Tables" ; toast d'expiration, message différent si `reason === 'tournament'`). Intégré dans `pages/Tables.tsx`.

## 8. Scénario complet, pas à pas

1. Baby A occupée par Alice. Bob puis Charlie rejoignent la file : position 1 et 2.
2. Alice libère → `advanceQueue()` appelle Bob, timer de 2 min, `queue:called` (lui seul).
3. **Cas A** : Bob occupe à temps → son entrée passe `DONE`, timer annulé.
4. **Cas B** : Bob ne réagit pas → après 2 min, `EXPIRED`, `queue:expired`, puis Charlie est appelé à son tour.

## 9. Erreurs possibles

| Exception | Quand |
| --- | --- |
| `ConflictException` | Réquisitionnée / table libre sans attente / déjà une entrée active |
| `ForbiddenException` | Annuler l'entrée de quelqu'un d'autre |

## 10. Questions probables à la soutenance

- **"Pourquoi ne pas stocker la position en base ?"** → Elle changerait à chaque annulation/expiration devant toi ; un `COUNT` à la lecture évite de renuméroter toute la file.
- **"Serveur qui redémarre pendant un timer de 2 min ?"** → Timer perdu (en mémoire), limite connue et acceptée.
- **"Tables ↔ Queue, comment évitez-vous un cycle de dépendances ?"** → Elles s'appellent mutuellement (`onTableOccupied`/`onTableFreed` d'un côté, `getActiveReservation` de l'autre), cassé avec `forwardRef()` au niveau module et constructeur.
- **"Pourquoi appeler automatiquement le suivant plutôt qu'un humain ?"** → Personne ne doit rester devant la table à surveiller ; on est notifié quand c'est son tour.
- **"Que se passe-t-il si deux personnes cliquent Occuper en même temps ?"** → `updateMany` + vérification du `count` (Partie 1, §5.1) : une seule requête réussit.
