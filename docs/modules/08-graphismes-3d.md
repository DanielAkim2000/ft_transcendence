# Graphismes 3D avancés (Three.js)

**Type** : Major (2 pts)  ·  **Sujet** : IV.6 Gaming — « Implement advanced 3D graphics using a library like Three.js »  ·  **Tag dans le code** : `[Major · Graphismes 3D]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Major · Graphismes 3D] … */` : cherchez `[Major · Graphismes 3D]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Environnement 3D immersif.
- Techniques de rendu avancées.
- Performances et interaction fluides.

## Ce qui est implémenté

Le plateau d'échecs est une scène **Three.js** complète : pièces modélisées procéduralement, éclairage et ombres douces, caméra orbitale tactile, sélection par lancer de rayon et retournement automatique selon la couleur du joueur.

## Logique utilisée

1. **Modèles** (`pieceModels.ts`) : chaque pièce est construite par code (géométries de révolution `LatheGeometry`, sphères, boîtes, tête de cavalier extrudée depuis une `Shape`) puis fusionnée en une seule géométrie (`mergeGeometries`) et mise en cache : un mesh par pièce = peu d'appels de rendu.
2. **Scène** (`ChessBoard3D`) : fond et brouillard, lumière hémisphérique + lumière directionnelle principale qui projette des **ombres VSM** (douces) + lumière d'appoint froide, matériaux PBR (`MeshStandardMaterial`, rugosité/métal), socle et cadre, 64 cases en boîtes, étiquettes a–h / 1–8 dessinées sur canvas en sprites.
3. **Interaction** : `OrbitControls` (rotation limitée pour ne jamais passer sous le plateau, zoom borné, amortissement, `touch-action: none` pour le tactile) ; un appui court (< seuil de déplacement) lance un `Raycaster` pour retrouver la case ou la pièce touchée, un glisser fait tourner la vue.
4. **Performance/propreté** : `ResizeObserver` adapte la taille, `setPixelRatio` plafonné à 2, boucle `requestAnimationFrame` annulée au démontage, géométries/matériaux libérés (`clearGroup`, `dispose`). Le canvas prend 100 % du conteneur pour rester centré sur mobile.
5. **Surbrillance** : la case sélectionnée et les coups légaux sont dessinés dans un groupe séparé (couleur d'accent lue dans le thème CSS).

## Fichiers concernés et rôle de chaque fonction

### Frontend (React)

**[`frontend/src/features/chess/ChessBoard3D.tsx`](../../frontend/src/features/chess/ChessBoard3D.tsx)**

- `placeLabels` ([l.77](../../frontend/src/features/chess/ChessBoard3D.tsx#L77)) — Pose les lettres (colonnes) du côté du joueur et les chiffres (rangées) sur son côté gauche, pour qu'ils restent lisibles quand le plateau est retour…
- `createLabel` ([l.86](../../frontend/src/features/chess/ChessBoard3D.tsx#L86)) — Repère toujours tourné vers la caméra : une lettre ou un chiffre dessiné sur un canvas.
- `clearGroup` ([l.107](../../frontend/src/features/chess/ChessBoard3D.tsx#L107)) — Retire un groupe de sa scène et libère les géométries/matériaux créés pour lui.
- `ChessBoard3D` ([l.118](../../frontend/src/features/chess/ChessBoard3D.tsx#L118)) — Plateau d'échecs en 3D (Three.js) : scène, éclairage et ombres, plateau et pièces modélisées, caméra orbitale (rotation/inclinaison tactile et souris…
- `animate` ([l.277](../../frontend/src/features/chess/ChessBoard3D.tsx#L277)) — Boucle de rendu : met à jour les contrôles (inertie) puis dessine la scène à chaque frame.

**[`frontend/src/features/chess/pieceModels.ts`](../../frontend/src/features/chess/pieceModels.ts)**

- `lathe` ([l.7](../../frontend/src/features/chess/pieceModels.ts#L7)) — Profil de révolution : liste de [rayon, hauteur] de bas en haut, terminée sur l'axe pour fermer le volume.
- `sphere` ([l.15](../../frontend/src/features/chess/pieceModels.ts#L15)) — Géométrie d'une sphère (éventuellement aplatie) placée à la hauteur y.
- `box` ([l.23](../../frontend/src/features/chess/pieceModels.ts#L23)) — Géométrie d'une boîte positionnée en (x, y, z).
- `ringOfSpheres` ([l.30](../../frontend/src/features/chess/pieceModels.ts#L30)) — Petites billes régulièrement réparties sur un cercle (pointes de la couronne de la dame).
- `battlements` ([l.40](../../frontend/src/features/chess/pieceModels.ts#L40)) — Créneaux de la tour : petits blocs sur le pourtour, orientés vers l'extérieur.
- `knightHead` ([l.51](../../frontend/src/features/chess/pieceModels.ts#L51)) — Tête et encolure du cheval : silhouette de profil (museau vers +x) extrudée en épaisseur.
- `getPieceGeometry` ([l.108](../../frontend/src/features/chess/pieceModels.ts#L108)) — Géométrie (unique, mise en cache) d'un type de pièce, posée sur y = 0 et centrée sur son axe.

## Comment le démontrer

- Faire pivoter/zoomer le plateau à la souris et au doigt ; jouer avec les noirs (vue retournée) ; observer les ombres et la surbrillance des coups.
