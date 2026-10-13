# Adversaire IA pour les échecs

**Type** : Major (2 pts)  ·  **Sujet** : IV.4 Artificial Intelligence — « Introduce an AI Opponent for games »  ·  **Tag dans le code** : `[Major · Adversaire IA]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Major · Adversaire IA] … */` : cherchez `[Major · Adversaire IA]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- IA difficile mais capable de perdre.
- Comportement « humain » (pas de jeu parfait).
- Pouvoir expliquer l'implémentation.

## Ce qui est implémenté

Quatre niveaux (Facile, Moyen, Difficile, Expert) pilotés par un **moteur de recherche négamax avec élagage alpha-bêta**, approfondissement itératif limité en temps, tables de valeurs de cases (PST) et recherche de quiescence. Les niveaux bas sont volontairement faillibles (bruit sur les scores, coups aléatoires).

## Logique utilisée

1. **Évaluation** (`evaluate`) : valeur des pièces (P=100, N=320, B=330, R=500, Q=900) + tables de position par pièce, du point de vue du camp au trait.
2. **Recherche** (`Searcher.search`) : approfondissement itératif de 1 à `maxDepth` ; à chaque profondeur on trie les coups (`orderMoves`, captures MVV-LVA) puis `negamax` avec alpha-bêta ; `checkTime` lève `TimeUp` quand le temps du niveau est écoulé et on garde le meilleur coup de la dernière profondeur terminée. `quiesce` prolonge la recherche sur les captures pour éviter l'effet d'horizon (niveaux Difficile/Expert).
3. **Faillibilité humaine** : `noise` ajoute un bruit aléatoire au score de chaque coup racine (Facile 200, Moyen 40) et `randomChance` joue parfois un coup légal au hasard (Facile 25 %). Résultat : l'IA peut perdre, et se trompe de façon plausible.
4. **Niveaux** : Facile (profondeur 1, 0,5 s) · Moyen (2, 1 s) · Difficile (4, 1,5 s, quiescence) · Expert (8, 3,5 s, quiescence).
5. **Intégration** : `createAiGame` crée un compte « bot » factice par niveau (clé étrangère des parties) ; après chaque coup du joueur, `playBotTurn` calcule le coup dans un **worker thread** (`chess-ai.worker.ts`) pour ne pas bloquer Node, le joue via `playMove` et le gateway diffuse l'état.

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/chess/ai/chess-ai.ts`](../../backend/src/chess/ai/chess-ai.ts)**

- `evaluate` ([l.101](../../backend/src/chess/ai/chess-ai.ts#L101)) — Évaluation statique, du point de vue du camp au trait.
- `orderMoves` ([l.118](../../backend/src/chess/ai/chess-ai.ts#L118)) — Captures et promotions d'abord (MVV-LVA) : l'élagage coupe bien plus tôt.
- `weight` ([l.120](../../backend/src/chess/ai/chess-ai.ts#L120)) — Poids de tri d'un coup : valeur de la pièce capturée (MVV-LVA) + valeur de la promotion.
- `constructor` ([l.133](../../backend/src/chess/ai/chess-ai.ts#L133)) — Reçoit la position à analyser et la configuration du niveau (profondeur, temps, bruit, quiescence).
- `checkTime` ([l.139](../../backend/src/chess/ai/chess-ai.ts#L139)) — Compte les nœuds visités et interrompt la recherche (TimeUp) quand le temps imparti au niveau est écoulé.
- `quiesce` ([l.145](../../backend/src/chess/ai/chess-ai.ts#L145)) — Recherche de quiescence : prolonge l'analyse sur les captures seulement pour éviter l'effet d'horizon, avec élagage alpha-bêta.
- `negamax` ([l.166](../../backend/src/chess/ai/chess-ai.ts#L166)) — Négamax avec élagage alpha-bêta : renvoie le score d'une position à une profondeur donnée (mat, nulle, évaluation statique ou quiescence aux feuilles…
- `search` ([l.193](../../backend/src/chess/ai/chess-ai.ts#L193)) — Recherche itérative : la dernière profondeur terminée fait foi si le temps est écoulé.
- `chooseMove` ([l.235](../../backend/src/chess/ai/chess-ai.ts#L235)) — Choisit le coup de l'IA pour la position `fen` au niveau demandé.

**[`backend/src/chess/services/chess.service.ts`](../../backend/src/chess/services/chess.service.ts)**

- `botId` ([l.255](../../backend/src/chess/services/chess.service.ts#L255)) — Les adversaires IA sont de vrais comptes (clé étrangère des parties) créés à la demande.
- `isBot` ([l.260](../../backend/src/chess/services/chess.service.ts#L260)) — Indique si l'identifiant correspond à un compte d'IA (préfixe `chess-bot-`).
- `ensureBot` ([l.265](../../backend/src/chess/services/chess.service.ts#L265)) — Crée à la demande le compte factice de l'IA du niveau demandé (nécessaire pour les clés étrangères des parties) et renvoie son id.
- `computeAiMove` ([l.280](../../backend/src/chess/services/chess.service.ts#L280)) — Calcule le coup de l'IA dans un thread à part (la recherche peut durer plusieurs secondes).
- `playBotTurn` ([l.294](../../backend/src/chess/services/chess.service.ts#L294)) — Joue le coup de l'IA si c'est son tour dans cette partie ; renvoie la partie mise à jour, sinon null.
- `createAiGame` ([l.324](../../backend/src/chess/services/chess.service.ts#L324)) — Crée et démarre tout de suite une partie contre l'IA (couleur au choix ou tirée au hasard) ; si l'IA a les blancs, elle joue son premier coup avant d…

## Comment le démontrer

- Lancer une partie contre chaque niveau ; montrer que Facile fait des erreurs et qu'Expert répond plus lentement mais mieux.

## Points à connaître / limites

- Pas de livre d'ouvertures ni de table de transposition : la force d'Expert est limitée par le temps de réflexion fixé (3,5 s).
