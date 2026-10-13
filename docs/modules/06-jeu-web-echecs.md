# Jeu web complet : les échecs

**Type** : Major (2 pts)  ·  **Sujet** : IV.6 Gaming — « Implement a complete web-based game where users can play against each other »  ·  **Tag dans le code** : `[Major · Jeu web (Échecs)]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Major · Jeu web (Échecs)] … */` : cherchez `[Major · Jeu web (Échecs)]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Jeu multijoueur en temps réel.
- Parties en direct.
- Règles claires et conditions de victoire/défaite.
- 2D ou 3D.

## Ce qui est implémenté

Parties d'échecs complètes entre deux joueurs : défi d'un ami (depuis le lobby ou depuis le chat), acceptation/refus, coups validés côté serveur avec **chess.js**, diffusion en direct, fin de partie (mat, pat, nulle par répétition, matériel insuffisant, abandon), historique des parties et liste des coups.

## Logique utilisée

1. **Cycle de vie** : `createGame` (PENDING) → `acceptGame` (ACTIVE) ou `declineGame` (DECLINED) → coups → FINISHED. Un défi envoie une invitation dans le chat et une notification.
2. **Autorité serveur** : `playMove` vérifie que la partie est active et que c'est bien le tour du joueur, rejoue le coup avec chess.js (coup illégal → `ILLEGAL_MOVE`), détecte mat/pat/triple répétition (clé de position + `positionHistory`)/matériel insuffisant, puis enregistre la partie et le coup dans **une transaction**.
3. **Temps réel** : le client émet `chess:move` / `chess:resign` ; `ChessGateway` répond `chess:state` aux deux joueurs (ou `chess:error` à l'émetteur, avec un code traduit côté UI).
4. **Front** : `pages/Chess.tsx` (lobby + partie) calcule les coups légaux pour la surbrillance (`features/chess/utils.ts`), gère la promotion, l'abandon, la modale de résultat, le chat de la partie et la liste des coups (`ChessMoveList`). Le plateau est rendu par `ChessBoard3D`.

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/chess/ai/chess-ai.ts`](../../backend/src/chess/ai/chess-ai.ts)**

- `TimeUp` ([l.98](../../backend/src/chess/ai/chess-ai.ts#L98)) — Exception interne signalant que le temps de réflexion de l'IA est écoulé.
- `Searcher` ([l.128](../../backend/src/chess/ai/chess-ai.ts#L128)) — Moteur de recherche de l'IA : négamax à élagage alpha-bêta, approfondissement itératif, quiescence et bruit selon le niveau.

**[`backend/src/chess/chess.controller.ts`](../../backend/src/chess/chess.controller.ts)**

- `ChessController` ([l.20](../../backend/src/chess/chess.controller.ts#L20)) — Contrôleur HTTP des parties d'échecs : routes REST protégées par les guards d'authentification.
- `create` ([l.26](../../backend/src/chess/chess.controller.ts#L26)) — POST /chess/games : envoie un défi de partie à un autre joueur (couleur, pendule, partie classée ou non).
- `createAi` ([l.35](../../backend/src/chess/chess.controller.ts#L35)) — POST /chess/games/ai : démarre immédiatement une partie contre l'IA au niveau et à la couleur choisis.
- `listMine` ([l.44](../../backend/src/chess/chess.controller.ts#L44)) — GET /chess/games/me : parties en attente ou en cours de l'utilisateur connecté.
- `history` ([l.50](../../backend/src/chess/chess.controller.ts#L50)) — GET /chess/games/history : historique paginé des parties terminées de l'utilisateur.
- `get` ([l.59](../../backend/src/chess/chess.controller.ts#L59)) — GET /chess/games/:id : détail d'une partie (réservé aux deux joueurs).
- `moves` ([l.65](../../backend/src/chess/chess.controller.ts#L65)) — GET /chess/games/:id/moves : liste ordonnée des coups (notation SAN) de la partie.
- `accept` ([l.71](../../backend/src/chess/chess.controller.ts#L71)) — POST /chess/games/:id/accept : l'adversaire accepte le défi, la partie devient active.
- `decline` ([l.77](../../backend/src/chess/chess.controller.ts#L77)) — POST /chess/games/:id/decline : l'adversaire refuse le défi.

**[`backend/src/chess/chess.module.ts`](../../backend/src/chess/chess.module.ts)**

- `ChessModule` ([l.10](../../backend/src/chess/chess.module.ts#L10)) — Module NestJS des parties d'échecs : regroupe contrôleur, services et dépendances.

**[`backend/src/chess/dto/create-ai-game.dto.ts`](../../backend/src/chess/dto/create-ai-game.dto.ts)**

- `CreateAiGameDto` ([l.4](../../backend/src/chess/dto/create-ai-game.dto.ts#L4)) — Corps validé de création d'une partie contre l'IA (niveau, couleur).

**[`backend/src/chess/dto/create-game.dto.ts`](../../backend/src/chess/dto/create-game.dto.ts)**

- `CreateGameDto` ([l.10](../../backend/src/chess/dto/create-game.dto.ts#L10)) — Corps validé d'un défi d'échecs (adversaire, couleur, pendule, incrément, classée).

**[`backend/src/chess/services/chess.service.ts`](../../backend/src/chess/services/chess.service.ts)**

- `ChessService` ([l.34](../../backend/src/chess/services/chess.service.ts#L34)) — Service métier des parties d'échecs.
- `constructor` ([l.39](../../backend/src/chess/services/chess.service.ts#L39)) — Injecte Prisma, le chat (invitation de partie envoyée dans la conversation) et les notifications.
- `displayName` ([l.46](../../backend/src/chess/services/chess.service.ts#L46)) — Nom d'affichage d'un joueur (pour les notifications), « ? » s'il est introuvable.
- `listGames` ([l.55](../../backend/src/chess/services/chess.service.ts#L55)) — Parties en attente ou en cours d'un joueur (avec noms et avatars des deux camps), la plus récemment mise à jour d'abord.
- `listMoves` ([l.74](../../backend/src/chess/services/chess.service.ts#L74)) — Coups joués d'une partie, dans l'ordre (réservé aux deux joueurs).
- `listHistory` ([l.84](../../backend/src/chess/services/chess.service.ts#L84)) — Historique paginé : les parties terminées de l'utilisateur, les plus récentes d'abord.
- `getGame` ([l.104](../../backend/src/chess/services/chess.service.ts#L104)) — Charge une partie et vérifie que l'utilisateur en est l'un des deux joueurs (404 GAME_NOT_FOUND, 403 NOT_YOUR_GAME).
- `playMove` ([l.133](../../backend/src/chess/services/chess.service.ts#L133)) — Joue un coup : vérifie que la partie est active et que c'est le tour du joueur, valide la légalité avec chess.js, détecte mat, pat, triple répétition…
- `resign` ([l.233](../../backend/src/chess/services/chess.service.ts#L233)) — Abandon : la partie se termine tout de suite, victoire de l'adversaire.
- `createGame` ([l.356](../../backend/src/chess/services/chess.service.ts#L356)) — Envoie un défi : refuse l'auto-défi, un adversaire inconnu ou bot, un blocage entre joueurs et une partie déjà ouverte avec ce joueur ; crée la parti…
- `acceptGame` ([l.446](../../backend/src/chess/services/chess.service.ts#L446)) — L'adversaire accepte le défi : la partie passe en ACTIVE (horodatages, pendules, historique de positions), les profils d'échecs sont créés au besoin …
- `declineGame` ([l.508](../../backend/src/chess/services/chess.service.ts#L508)) — L'adversaire refuse le défi : la partie passe en DECLINED et le challenger est notifié.

### Frontend (React)

**[`frontend/src/features/chess/ChessBoard3D.tsx`](../../frontend/src/features/chess/ChessBoard3D.tsx)**

- `readAccentColor` ([l.38](../../frontend/src/features/chess/ChessBoard3D.tsx#L38)) — Couleur d'accent du joueur (variable CSS --primary posée par son réglage et le thème), en entier 0xRRGGBB ; vert par défaut si elle est illisible.
- `isLegalPosition` ([l.55](../../frontend/src/features/chess/ChessBoard3D.tsx#L55)) — Vrai si la case fait partie des destinations légales (surbrillance).
- `handlePointerDown` ([l.244](../../frontend/src/features/chess/ChessBoard3D.tsx#L244)) — Début d'un appui : mémorise la position pour distinguer un clic d'un glisser (rotation de la vue).
- `handlePointerUp` ([l.248](../../frontend/src/features/chess/ChessBoard3D.tsx#L248)) — Fin d'appui : si le pointeur a peu bougé, lance un rayon depuis la caméra, retrouve la case ou la pièce touchée et appelle le gestionnaire de clic.

**[`frontend/src/features/chess/ChessLauncher.tsx`](../../frontend/src/features/chess/ChessLauncher.tsx)**

- `ChessLauncher` ([l.14](../../frontend/src/features/chess/ChessLauncher.tsx#L14)) — Bouton flottant (bas droite des pages connectées) qui ouvre une invitation à jouer aux échecs ; masqué sur la page des échecs et sur le chat, où il r…
- `play` ([l.35](../../frontend/src/features/chess/ChessLauncher.tsx#L35)) — Ferme le bouton flottant et ouvre la page des échecs.

**[`frontend/src/features/chess/ChessMoveList.tsx`](../../frontend/src/features/chess/ChessMoveList.tsx)**

- `ChessMoveList` ([l.12](../../frontend/src/features/chess/ChessMoveList.tsx#L12)) — Historique des coups en notation algébrique, rangé par numéro de coup (« 1.
- `cell` ([l.34](../../frontend/src/features/chess/ChessMoveList.tsx#L34)) — Cellule d'un coup (notation SAN), le dernier coup joué étant mis en évidence.

**[`frontend/src/features/chess/ChessPlayerBar.tsx`](../../frontend/src/features/chess/ChessPlayerBar.tsx)**

- `ChessPlayerBar` ([l.18](../../frontend/src/features/chess/ChessPlayerBar.tsx#L18)) — Barre d'un joueur autour de l'échiquier : avatar, nom, couleur des pièces et indication du trait.

**[`frontend/src/features/chess/chessApi.ts`](../../frontend/src/features/chess/chessApi.ts)**

- `chessApi` ([l.72](../../frontend/src/features/chess/chessApi.ts#L72)) — Endpoints RTK Query du domaine « chess » (requêtes/mutations typées, cache et invalidation par tags) : LIST_GAMES, LIST_HISTORY, GET_GAME, GET_MOVES,…

**[`frontend/src/features/chess/utils.ts`](../../frontend/src/features/chess/utils.ts)**

- `makePiece` ([l.24](../../frontend/src/features/chess/utils.ts#L24)) — Crée une pièce (type, couleur, premier coup non joué) pour le plateau local.
- `boardFromFen` ([l.29](../../frontend/src/features/chess/utils.ts#L29)) — Construit la grille 8×8 du plateau à partir d'une position FEN (pièces, droits de roque).
- `slide` ([l.67](../../frontend/src/features/chess/utils.ts#L67)) — Cases atteignables par une pièce à longue portée (tour, fou, dame) dans des directions données, jusqu'au premier obstacle.
- `getRawMoves` ([l.95](../../frontend/src/features/chess/utils.ts#L95)) — Déplacements bruts d'une pièce (sans vérifier l'échec) : pas du pion, prise en passant, sauts du cavalier, roi, glissements.
- `isSquareAttacked` ([l.172](../../frontend/src/features/chess/utils.ts#L172)) — Vrai si une case est attaquée par une couleur (sert à interdire les roques et les coups qui laissent le roi en échec).
- `opponentColor` ([l.194](../../frontend/src/features/chess/utils.ts#L194)) — Couleur adverse.
- `canMoove` ([l.199](../../frontend/src/features/chess/utils.ts#L199)) — Coups légaux d'une pièce : coups bruts filtrés pour ne pas laisser son roi en échec, plus les roques ; sert à afficher les destinations.

**[`frontend/src/pages/Chess.tsx`](../../frontend/src/pages/Chess.tsx)**

- `Chess` ([l.45](../../frontend/src/pages/Chess.tsx#L45)) — Page des échecs : lobby (parties en cours, invitations reçues, défier un ami, jouer contre l'IA, historique) ou partie en cours (plateau 3D, joueurs,…
- `isSelected` ([l.206](../../frontend/src/pages/Chess.tsx#L206)) — Vrai si la case est une destination légale de la pièce sélectionnée.
- `selectPiece` ([l.215](../../frontend/src/pages/Chess.tsx#L215)) — Clic sur une case : sélectionne une pièce du joueur (calcul des coups légaux) ou, si la case est une destination, envoie le coup au serveur (ouvre le…
- `handleResign` ([l.250](../../frontend/src/pages/Chess.tsx#L250)) — Abandon : envoie `chess:resign` au serveur.
- `leaveGame` ([l.256](../../frontend/src/pages/Chess.tsx#L256)) — Quitte la partie et revient au lobby.
- `handleReplay` ([l.262](../../frontend/src/pages/Chess.tsx#L262)) — Rejouer : crée une nouvelle partie contre la même IA, ou renvoie un défi au même adversaire.
- `choosePromotion` ([l.280](../../frontend/src/pages/Chess.tsx#L280)) — Choix de la pièce de promotion (dame, tour, fou, cavalier) puis envoi du coup.
- `toSquare` ([l.290](../../frontend/src/pages/Chess.tsx#L290)) — Convertit (ligne, colonne) du plateau en notation algébrique (ex.
- `fromSquare` ([l.295](../../frontend/src/pages/Chess.tsx#L295)) — Convertit une case algébrique (ex.
- `handleCreateGame` ([l.340](../../frontend/src/pages/Chess.tsx#L340)) — Défie un ami (couleur aléatoire) et confirme par un toast.
- `handleCreateAiGame` ([l.350](../../frontend/src/pages/Chess.tsx#L350)) — Crée une partie contre l'IA avec le niveau et la couleur choisis, et l'ouvre.
- `handleAcceptGame` ([l.360](../../frontend/src/pages/Chess.tsx#L360)) — Accepte une invitation de partie et l'ouvre.
- `handleDeclineGame` ([l.371](../../frontend/src/pages/Chess.tsx#L371)) — Refuse une invitation de partie.

### Base de données

**[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)**

- `ChessColor` ([l.163](../../backend/prisma/schema.prisma#L163)) — Camp d'un joueur (blancs ou noirs).
- `ChessGameStatus` ([l.169](../../backend/prisma/schema.prisma#L169)) — Cycle de vie d'une partie d'échecs.
- `ChessResult` ([l.177](../../backend/prisma/schema.prisma#L177)) — Résultat d'une partie.
- `ChessEndReason` ([l.185](../../backend/prisma/schema.prisma#L185)) — Raison de fin de partie (mat, pat, abandon, répétition, matériel…).
- `ChessProfile` ([l.595](../../backend/prisma/schema.prisma#L595)) — Profil d'échecs d'un joueur (note, statistiques).
- `ChessGame` ([l.613](../../backend/prisma/schema.prisma#L613)) — Partie d'échecs (en cours et historique).
- `ChessMove` ([l.671](../../backend/prisma/schema.prisma#L671)) — Coup joué d'une partie (notation SAN, FEN après le coup).

## Comment le démontrer

- Défier un ami, accepter, jouer jusqu'à un mat ; abandonner une autre partie ; consulter l'historique.

## Points à connaître / limites

- Les profils d'échecs (`ChessProfile` : note, victoires…) existent en base mais ne sont pas encore mis à jour à la fin d'une partie : l'historique des parties est disponible, pas le classement d'échecs.
- Pas de pendule active (le DTO accepte `timeControlMs`, mais aucune logique de temps n'arrête la partie).
