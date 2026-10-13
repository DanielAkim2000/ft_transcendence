# Recherche avancée (filtres, tri, pagination)

**Type** : Minor (1 pt)  ·  **Sujet** : IV.1 Web — « Advanced search functionality with filters, sorting, and pagination »  ·  **Tag dans le code** : `[Minor · Recherche avancée]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Minor · Recherche avancée] … */` : cherchez `[Minor · Recherche avancée]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Recherche, filtres, tri et pagination.

## Ce qui est implémenté

Recherche côté serveur, validée par DTO, avec filtres, tri et pagination sur : le **classement** (nom, périmètre tous/amis, matchs minimum, tri), l'**historique des matchs** (joueur, résultat, format, origine, tri date ou écart de score), la **recherche d'utilisateurs** et la **liste d'amis** (nom, en ligne).

## Logique utilisée

1. **Pagination commune** : `PageQueryDto` (page ≥ 1, limite ≤ 50), `pageOffset` et `toPaginated` (items, total, totalPages ≥ 1).
2. **Classement** : `UserRepository.listRanking` applique filtres et tri, mais le rang affiché reste le rang global quelle que soit la recherche. **Historique** : `listHistoryForUser` ; le tri par écart de score est fait en mémoire sur l'ensemble filtré d'un seul joueur (petit) puis paginé.
3. **Front** : les barres de filtre sont *debouncées* (`useDebouncedValue`), toute modification revient à la page 1, `useClampedPage` replace la page si la liste rétrécit, `Pagination` affiche les boutons.

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/common/pagination/page-query.dto.ts`](../../backend/src/common/pagination/page-query.dto.ts)**

- `pageOffset` ([l.22](../../backend/src/common/pagination/page-query.dto.ts#L22)) — Nombre d'éléments à sauter pour atteindre la page demandée.

**[`backend/src/common/pagination/paginated.ts`](../../backend/src/common/pagination/paginated.ts)**

- `toPaginated` ([l.12](../../backend/src/common/pagination/paginated.ts#L12)) — Assemble une page de résultats avec son total ; `totalPages` vaut au moins 1 pour qu'une liste vide reste affichable.

**[`backend/src/matches/repositories/matches.repository.ts`](../../backend/src/matches/repositories/matches.repository.ts)**

- `listHistoryForUser` ([l.119](../../backend/src/matches/repositories/matches.repository.ts#L119)) — Historique : matchs terminés (ladder + manches de tournoi) filtrés par nom de joueur, résultat, format et origine, triés, une page plus le total.
- `gap` ([l.184](../../backend/src/matches/repositories/matches.repository.ts#L184)) — Écart de points entre les deux équipes : clé de tri « écart de score » de l'historique.

**[`backend/src/matches/services/matches.service.ts`](../../backend/src/matches/services/matches.service.ts)**

- `listHistory` ([l.62](../../backend/src/matches/services/matches.service.ts#L62)) — Liste une page des matchs terminés de l'utilisateur, ladder et tournois confondus, avec filtres et tri.

**[`backend/src/users/repositories/users.repository.ts`](../../backend/src/users/repositories/users.repository.ts)**

- `searchUsers` ([l.255](../../backend/src/users/repositories/users.repository.ts#L255)) — Cherche des utilisateurs par nom ou email (insensible à la casse), triés par nom, en excluant l'utilisateur donné : une page de résultats plus le tot…
- `findFriendshipStatuses` ([l.284](../../backend/src/users/repositories/users.repository.ts#L284)) — Relation d'amitié de l'utilisateur avec chacun des `otherIds` ('friends', 'pending_out' ou 'pending_in') ; les absents n'ont aucune relation.
- `textFilter` ([l.317](../../backend/src/users/repositories/users.repository.ts#L317)) — Filtre Prisma « le nom ou l'email contient le texte » (insensible à la casse) ; vide si aucun texte.
- `listRanking` ([l.458](../../backend/src/users/repositories/users.repository.ts#L458)) — Classement des joueurs actifs par note Elo (ex æquo = même rang), filtré par nom, périmètre (amis) et nombre de matchs, trié, une page plus le total.

**[`backend/src/users/services/users.services.ts`](../../backend/src/users/services/users.services.ts)**

- `searchUsers` ([l.88](../../backend/src/users/services/users.services.ts#L88)) — Recherche paginée d'utilisateurs (hors l'utilisateur courant) : chaque résultat porte sa relation d'amitié avec l'utilisateur, et la présence des non…

**[`backend/src/users/users.controller.ts`](../../backend/src/users/users.controller.ts)**

- `listUsers` ([l.41](../../backend/src/users/users.controller.ts#L41)) — GET /users?q=&page=&limit= : recherche paginée d'utilisateurs (nom ou email) hors utilisateur connecté, avec leur relation d'amitié ; la présence n'e…
- `getRanking` ([l.50](../../backend/src/users/users.controller.ts#L50)) — GET /users/ranking?page=&limit=&q=&scope=&minMatches=&sort= : page du classement par note Elo, avec recherche, filtres et tri.

### Frontend (React)

**[`frontend/src/components/pagination.tsx`](../../frontend/src/components/pagination.tsx)**

- `Pagination` ([l.11](../../frontend/src/components/pagination.tsx#L11)) — Barre Précédent / « Page x sur y » / Suivant ; masquée quand il n'y a qu'une page.

**[`frontend/src/features/matches/MatchHistoryList.tsx`](../../frontend/src/features/matches/MatchHistoryList.tsx)**

- `HistoryFilters` ([l.22](../../frontend/src/features/matches/MatchHistoryList.tsx#L22)) — Barre de recherche avancée : nom d'un joueur, résultat, format, origine et tri.
- `MatchHistoryList` ([l.174](../../frontend/src/features/matches/MatchHistoryList.tsx#L174)) — Historique des matchs avec recherche par joueur, filtres (résultat, format, origine), tri (date, écart de score) et pagination côté serveur.

**[`frontend/src/features/users/usersApi.ts`](../../frontend/src/features/users/usersApi.ts)**

- `toParams` ([l.34](../../frontend/src/features/users/usersApi.ts#L34)) — Retire les paramètres non définis pour ne pas les envoyer dans l'URL.

**[`frontend/src/lib/use-clamped-page.ts`](../../frontend/src/lib/use-clamped-page.ts)**

- `useClampedPage` ([l.3](../../frontend/src/lib/use-clamped-page.ts#L3)) — Ramène la page courante sur la dernière page existante quand la liste rétrécit (ex: dernier élément d'une page supprimé).

**[`frontend/src/lib/use-debounced-value.ts`](../../frontend/src/lib/use-debounced-value.ts)**

- `useDebouncedValue` ([l.3](../../frontend/src/lib/use-debounced-value.ts#L3)) — Retourne `value` avec un délai : évite une requête par frappe dans un champ de recherche.

**[`frontend/src/pages/Home.tsx`](../../frontend/src/pages/Home.tsx)**

- `PlayerSearch` ([l.110](../../frontend/src/pages/Home.tsx#L110)) — Barre de recherche de joueurs, à l'accueil : résultats en direct sous le champ, comme une invite de commande ("/").

**[`frontend/src/pages/Ranking.tsx`](../../frontend/src/pages/Ranking.tsx)**

- `RankingFilters` ([l.30](../../frontend/src/pages/Ranking.tsx#L30)) — Barre de recherche du classement : nom, périmètre (tous / mes amis), matchs minimum et tri.

## Comment le démontrer

- Dans Classement et Historique : taper un nom, changer filtres et tri, changer de page.
