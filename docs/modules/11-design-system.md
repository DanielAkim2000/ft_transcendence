# Design system personnalisé

**Type** : Minor (1 pt)  ·  **Sujet** : IV.1 Web — « Custom-made design system with reusable components (minimum: 10) »  ·  **Tag dans le code** : `[Minor · Design system]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Minor · Design system] … */` : cherchez `[Minor · Design system]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Composants réutilisables (≥ 10).
- Palette de couleurs, typographie, icônes.

## Ce qui est implémenté

Composants UI maison au-dessus de `@base-ui/react` : tokens CSS (clair/sombre, couleur d'accent et arrondi réglables), une police unique, icônes `lucide-react`, et plus de 20 composants réutilisables.

## Logique utilisée

1. **Tokens** (`index.css`) : variables de couleur claires/sombres, `data-accent` et `data-radius` posés sur `<html>` par `ThemeSync` ; le thème « système » suit `prefers-color-scheme` ; le favicon est regénéré à chaque changement (`syncFavicon`).
2. **Primitives** (`components/ui`) : Button (variantes, tailles, `loading` avec spinner), Card, Input, Label, Field (formulaires accessibles), RadioGroup, Avatar, Separator, Skeleton, Sheet, Sidebar, Toast, Tooltip, CodeInput (code 2FA à 6 chiffres).
3. **Composants applicatifs** : ConfirmDialog, ScoreConfirmDialog, Pagination, Loader/PageFallback/Skeletons (états de chargement), Logo, GridBackdrop, LegalLinks, AppSidebar.
4. `cn` (clsx + tailwind-merge) fusionne les classes ; `useIsMobile` pilote le comportement responsive.

## Fichiers concernés et rôle de chaque fonction

### Frontend (React)

**[`frontend/src/components/app-sidebar.tsx`](../../frontend/src/components/app-sidebar.tsx)**

- `AppSidebar` ([l.44](../../frontend/src/components/app-sidebar.tsx#L44)) — Barre latérale de navigation : liens (accueil, chat, amis, tables, tournois…), pastilles de notification (messages non lus, demandes, tour à jouer), …
- `dotLabel` ([l.117](../../frontend/src/components/app-sidebar.tsx#L117)) — Texte d'accessibilité de la pastille d'un lien selon l'événement en attente (messages, amis, tour, invitation, défi).
- `handleLogout` ([l.133](../../frontend/src/components/app-sidebar.tsx#L133)) — Déconnecte l'utilisateur (même si la session est déjà invalide) puis redirige vers /login.

**[`frontend/src/components/confirm-dialog.tsx`](../../frontend/src/components/confirm-dialog.tsx)**

- `ConfirmDialog` ([l.20](../../frontend/src/components/confirm-dialog.tsx#L20)) — Boîte de confirmation réutilisable (titre, description, corps, variante destructive) : déclenchée par son enfant, attend la confirmation et gère l'ét…
- `handleConfirm` ([l.36](../../frontend/src/components/confirm-dialog.tsx#L36)) — Exécute l'action confirmée, affiche l'attente puis ferme la boîte.

**[`frontend/src/components/grid-backdrop.tsx`](../../frontend/src/components/grid-backdrop.tsx)**

- `GridBackdrop` ([l.1](../../frontend/src/components/grid-backdrop.tsx#L1)) — Fond décoratif quadrillé aux couleurs d'accent.

**[`frontend/src/components/legal-links.tsx`](../../frontend/src/components/legal-links.tsx)**

- `LegalLinks` ([l.6](../../frontend/src/components/legal-links.tsx#L6)) — Liens vers la politique de confidentialité, les conditions et la page de statut.

**[`frontend/src/components/loader.tsx`](../../frontend/src/components/loader.tsx)**

- `Loader` ([l.11](../../frontend/src/components/loader.tsx#L11)) — Indicateur de chargement aux couleurs de l'app : invite de terminal, barre indéterminée et libellé.

**[`frontend/src/components/logo.tsx`](../../frontend/src/components/logo.tsx)**

- `Logo` ([l.10](../../frontend/src/components/logo.tsx#L10)) — 

**[`frontend/src/components/navigation-bridge.tsx`](../../frontend/src/components/navigation-bridge.tsx)**

- `NavigationBridge` ([l.5](../../frontend/src/components/navigation-bridge.tsx#L5)) — Enregistre la fonction `navigate` de React Router pour pouvoir naviguer hors des composants (store, sockets).

**[`frontend/src/components/page-fallback.tsx`](../../frontend/src/components/page-fallback.tsx)**

- `PageFallback` ([l.4](../../frontend/src/components/page-fallback.tsx#L4)) — Affiché pendant le chargement à la demande d'une page : plein écran hors du tableau de bord, simple bloc centré dans la zone de contenu sinon.

**[`frontend/src/components/score-confirm-dialog.tsx`](../../frontend/src/components/score-confirm-dialog.tsx)**

- `ScoreRecap` ([l.21](../../frontend/src/components/score-confirm-dialog.tsx#L21)) — Récapitulatif du score (équipes, score, vainqueur) : on relit ce qu'on a saisi avant d'enregistrer.
- `side` ([l.29](../../frontend/src/components/score-confirm-dialog.tsx#L29)) — Rend un camp du récapitulatif (nom, score) en mettant le gagnant en évidence.
- `ScoreConfirmDialog` ([l.59](../../frontend/src/components/score-confirm-dialog.tsx#L59)) — Demande de confirmation avant d'enregistrer un score : rappelle le score saisi, qui gagne, et ce qui se passera ensuite.

**[`frontend/src/components/skeletons.tsx`](../../frontend/src/components/skeletons.tsx)**

- `RowSkeleton` ([l.21](../../frontend/src/components/skeletons.tsx#L21)) — Ligne fantôme à la place d'une ligne de liste (avatar, deux lignes de texte, action) : mêmes marges que les vraies lignes pour éviter tout saut de mi…
- `ListSkeleton` ([l.57](../../frontend/src/components/skeletons.tsx#L57)) — Liste de lignes fantômes, annoncée « chargement » aux lecteurs d'écran.
- `CardSkeleton` ([l.72](../../frontend/src/components/skeletons.tsx#L72)) — Bloc fantôme d'une carte (titre + quelques lignes), pour les cartes de match, de table ou de profil.

**[`frontend/src/components/ui/avatar.tsx`](../../frontend/src/components/ui/avatar.tsx)**

- `Avatar` ([l.6](../../frontend/src/components/ui/avatar.tsx#L6)) — Conteneur d'avatar rond (tailles sm/default/lg) : image avec repli sur les initiales.
- `AvatarImage` ([l.27](../../frontend/src/components/ui/avatar.tsx#L27)) — Image de l'avatar ; masquée si elle ne charge pas.
- `AvatarFallback` ([l.41](../../frontend/src/components/ui/avatar.tsx#L41)) — Contenu de repli (initiales) tant que l'image n'est pas disponible.
- `AvatarBadge` ([l.58](../../frontend/src/components/ui/avatar.tsx#L58)) — Pastille de statut posée sur le coin de l'avatar (ex.
- `AvatarGroup` ([l.75](../../frontend/src/components/ui/avatar.tsx#L75)) — Empile plusieurs avatars en se chevauchant.
- `AvatarGroupCount` ([l.89](../../frontend/src/components/ui/avatar.tsx#L89)) — Pastille « +N » d'un groupe d'avatars.

**[`frontend/src/components/ui/button.tsx`](../../frontend/src/components/ui/button.tsx)**

- `Button` ([l.44](../../frontend/src/components/ui/button.tsx#L44)) — Bouton du design system : variantes (default, outline, secondary, ghost, destructive, link), tailles (xs → lg, icônes) et prop `loading` qui affiche …

**[`frontend/src/components/ui/card.tsx`](../../frontend/src/components/ui/card.tsx)**

- `Card` ([l.5](../../frontend/src/components/ui/card.tsx#L5)) — Conteneur carte de base (bordure, fond, ombre).
- `CardHeader` ([l.24](../../frontend/src/components/ui/card.tsx#L24)) — En-tête de carte (titre, description, action).
- `CardTitle` ([l.38](../../frontend/src/components/ui/card.tsx#L38)) — Titre d'une carte.
- `CardDescription` ([l.52](../../frontend/src/components/ui/card.tsx#L52)) — Texte secondaire sous le titre d'une carte.
- `CardAction` ([l.63](../../frontend/src/components/ui/card.tsx#L63)) — Zone d'action alignée à droite dans l'en-tête de carte.
- `CardContent` ([l.77](../../frontend/src/components/ui/card.tsx#L77)) — Corps d'une carte.
- `CardFooter` ([l.88](../../frontend/src/components/ui/card.tsx#L88)) — Pied de carte (boutons, liens).

**[`frontend/src/components/ui/code-input.tsx`](../../frontend/src/components/ui/code-input.tsx)**

- `CodeInput` ([l.15](../../frontend/src/components/ui/code-input.tsx#L15)) — Champ de saisie d'un code à 6 chiffres (une case par chiffre, collage et navigation clavier) utilisé pour la 2FA.

**[`frontend/src/components/ui/field.tsx`](../../frontend/src/components/ui/field.tsx)**

- `FieldSet` ([l.8](../../frontend/src/components/ui/field.tsx#L8)) — Regroupement sémantique (fieldset) de champs de formulaire.
- `FieldLegend` ([l.22](../../frontend/src/components/ui/field.tsx#L22)) — Légende d'un FieldSet.
- `FieldGroup` ([l.41](../../frontend/src/components/ui/field.tsx#L41)) — Pile verticale de champs avec espacement uniforme.
- `Field` ([l.73](../../frontend/src/components/ui/field.tsx#L73)) — Un champ de formulaire (label + contrôle + aide/erreur), orientation verticale ou horizontale.
- `FieldContent` ([l.90](../../frontend/src/components/ui/field.tsx#L90)) — Colonne regroupant libellé et description d'un champ.
- `FieldLabel` ([l.104](../../frontend/src/components/ui/field.tsx#L104)) — Libellé d'un champ.
- `FieldTitle` ([l.122](../../frontend/src/components/ui/field.tsx#L122)) — Titre dans une carte de champ.
- `FieldDescription` ([l.136](../../frontend/src/components/ui/field.tsx#L136)) — Texte d'aide sous un champ.
- `FieldSeparator` ([l.152](../../frontend/src/components/ui/field.tsx#L152)) — Séparateur entre champs, avec texte optionnel.
- `FieldError` ([l.183](../../frontend/src/components/ui/field.tsx#L183)) — Message d'erreur d'un champ (accessible, un ou plusieurs messages).

**[`frontend/src/components/ui/input.tsx`](../../frontend/src/components/ui/input.tsx)**

- `Input` ([l.6](../../frontend/src/components/ui/input.tsx#L6)) — Champ de saisie texte stylé aux couleurs du design system.

**[`frontend/src/components/ui/label.tsx`](../../frontend/src/components/ui/label.tsx)**

- `Label` ([l.5](../../frontend/src/components/ui/label.tsx#L5)) — Libellé de formulaire associé à son champ.

**[`frontend/src/components/ui/radio-group.tsx`](../../frontend/src/components/ui/radio-group.tsx)**

- `RadioGroup` ([l.8](../../frontend/src/components/ui/radio-group.tsx#L8)) — Groupe de boutons radio accessible (navigation clavier).
- `RadioGroupItem` ([l.19](../../frontend/src/components/ui/radio-group.tsx#L19)) — Un bouton radio d'un RadioGroup.

**[`frontend/src/components/ui/separator.tsx`](../../frontend/src/components/ui/separator.tsx)**

- `Separator` ([l.5](../../frontend/src/components/ui/separator.tsx#L5)) — Trait de séparation horizontal ou vertical.

**[`frontend/src/components/ui/sheet.tsx`](../../frontend/src/components/ui/sheet.tsx)**

- `Sheet` ([l.8](../../frontend/src/components/ui/sheet.tsx#L8)) — Panneau latéral coulissant (racine) : utilisé pour la sidebar mobile.
- `SheetTrigger` ([l.13](../../frontend/src/components/ui/sheet.tsx#L13)) — Élément qui ouvre le panneau.
- `SheetClose` ([l.18](../../frontend/src/components/ui/sheet.tsx#L18)) — Élément qui ferme le panneau.
- `SheetPortal` ([l.23](../../frontend/src/components/ui/sheet.tsx#L23)) — Rend le panneau hors de l'arbre DOM courant.
- `SheetOverlay` ([l.28](../../frontend/src/components/ui/sheet.tsx#L28)) — Voile sombre derrière le panneau.
- `SheetContent` ([l.42](../../frontend/src/components/ui/sheet.tsx#L42)) — Contenu du panneau (côté configurable, bouton de fermeture).
- `SheetHeader` ([l.87](../../frontend/src/components/ui/sheet.tsx#L87)) — En-tête du panneau.
- `SheetFooter` ([l.98](../../frontend/src/components/ui/sheet.tsx#L98)) — Pied du panneau.
- `SheetTitle` ([l.109](../../frontend/src/components/ui/sheet.tsx#L109)) — Titre accessible du panneau.
- `SheetDescription` ([l.123](../../frontend/src/components/ui/sheet.tsx#L123)) — Description accessible du panneau.

**[`frontend/src/components/ui/sidebar.tsx`](../../frontend/src/components/ui/sidebar.tsx)**

- `useSidebar` ([l.47](../../frontend/src/components/ui/sidebar.tsx#L47)) — Hook donnant l'état de la sidebar (ouverte, mobile, bascule) ; doit être utilisé sous SidebarProvider.
- `SidebarProvider` ([l.57](../../frontend/src/components/ui/sidebar.tsx#L57)) — Fournit l'état de la sidebar (ouverte/repliée, persistée en cookie) et le raccourci clavier Ctrl/Cmd+B.
- `handleKeyDown` ([l.100](../../frontend/src/components/ui/sidebar.tsx#L100)) — Raccourci clavier Ctrl/Cmd+B pour ouvrir ou replier la sidebar.
- `Sidebar` ([l.155](../../frontend/src/components/ui/sidebar.tsx#L155)) — Sidebar responsive : fixe sur bureau (repliable), panneau Sheet sur mobile.
- `SidebarTrigger` ([l.258](../../frontend/src/components/ui/sidebar.tsx#L258)) — Bouton qui ouvre ou replie la sidebar.
- `SidebarRail` ([l.285](../../frontend/src/components/ui/sidebar.tsx#L285)) — Fine zone cliquable sur le bord pour replier la sidebar.
- `SidebarInset` ([l.311](../../frontend/src/components/ui/sidebar.tsx#L311)) — Zone de contenu principal à côté de la sidebar.
- `SidebarInput` ([l.325](../../frontend/src/components/ui/sidebar.tsx#L325)) — Champ de recherche intégré à la sidebar.
- `SidebarHeader` ([l.340](../../frontend/src/components/ui/sidebar.tsx#L340)) — En-tête de la sidebar.
- `SidebarFooter` ([l.352](../../frontend/src/components/ui/sidebar.tsx#L352)) — Pied de la sidebar.
- `SidebarSeparator` ([l.364](../../frontend/src/components/ui/sidebar.tsx#L364)) — Séparateur dans la sidebar.
- `SidebarContent` ([l.379](../../frontend/src/components/ui/sidebar.tsx#L379)) — Zone défilante centrale de la sidebar.
- `SidebarGroup` ([l.394](../../frontend/src/components/ui/sidebar.tsx#L394)) — Groupe de liens de la sidebar.
- `SidebarGroupLabel` ([l.406](../../frontend/src/components/ui/sidebar.tsx#L406)) — Titre d'un groupe de la sidebar.
- `SidebarGroupAction` ([l.431](../../frontend/src/components/ui/sidebar.tsx#L431)) — Bouton d'action d'un groupe.
- `SidebarGroupContent` ([l.456](../../frontend/src/components/ui/sidebar.tsx#L456)) — Contenu d'un groupe.
- `SidebarMenu` ([l.471](../../frontend/src/components/ui/sidebar.tsx#L471)) — Liste de menu de la sidebar.
- `SidebarMenuItem` ([l.483](../../frontend/src/components/ui/sidebar.tsx#L483)) — Élément de menu.
- `SidebarMenuButton` ([l.517](../../frontend/src/components/ui/sidebar.tsx#L517)) — Bouton ou lien de menu (variantes, état actif, info-bulle quand la sidebar est repliée).
- `SidebarMenuAction` ([l.572](../../frontend/src/components/ui/sidebar.tsx#L572)) — Action secondaire à droite d'un élément de menu.
- `SidebarMenuBadge` ([l.603](../../frontend/src/components/ui/sidebar.tsx#L603)) — Pastille de compteur sur un élément de menu.
- `SidebarMenuSkeleton` ([l.621](../../frontend/src/components/ui/sidebar.tsx#L621)) — Squelette de chargement d'un élément de menu.
- `SidebarMenuSub` ([l.660](../../frontend/src/components/ui/sidebar.tsx#L660)) — Sous-menu imbriqué.
- `SidebarMenuSubItem` ([l.675](../../frontend/src/components/ui/sidebar.tsx#L675)) — Élément d'un sous-menu.
- `SidebarMenuSubButton` ([l.690](../../frontend/src/components/ui/sidebar.tsx#L690)) — Lien d'un sous-menu.

**[`frontend/src/components/ui/skeleton.tsx`](../../frontend/src/components/ui/skeleton.tsx)**

- `Skeleton` ([l.3](../../frontend/src/components/ui/skeleton.tsx#L3)) — Bloc animé de chargement (placeholder).

**[`frontend/src/components/ui/toast.tsx`](../../frontend/src/components/ui/toast.tsx)**

- `ToastProvider` ([l.10](../../frontend/src/components/ui/toast.tsx#L10)) — Fournit le gestionnaire de toasts à l'application.
- `ToastPortal` ([l.15](../../frontend/src/components/ui/toast.tsx#L15)) — Rend les toasts au-dessus de la page.
- `ToastViewport` ([l.20](../../frontend/src/components/ui/toast.tsx#L20)) — Zone d'affichage des toasts (coin de l'écran).
- `Toast` ([l.34](../../frontend/src/components/ui/toast.tsx#L34)) — Un toast (variantes par type : succès, erreur, info) avec animation d'entrée/sortie.
- `ToastContent` ([l.62](../../frontend/src/components/ui/toast.tsx#L62)) — Contenu d'un toast.
- `ToastTitle` ([l.76](../../frontend/src/components/ui/toast.tsx#L76)) — Titre d'un toast.
- `ToastDescription` ([l.87](../../frontend/src/components/ui/toast.tsx#L87)) — Description d'un toast.
- `ToastAction` ([l.101](../../frontend/src/components/ui/toast.tsx#L101)) — Bouton d'action d'un toast (ex.
- `ToastClose` ([l.117](../../frontend/src/components/ui/toast.tsx#L117)) — Bouton de fermeture d'un toast.
- `ToastIcon` ([l.142](../../frontend/src/components/ui/toast.tsx#L142)) — Icône d'un toast selon son type.
- `ToastList` ([l.190](../../frontend/src/components/ui/toast.tsx#L190)) — Liste des toasts actifs.
- `Toaster` ([l.209](../../frontend/src/components/ui/toast.tsx#L209)) — Composant à monter une fois : affiche les toasts déclenchés par `toast.add(...)` partout dans l'app (support du système de notifications).

**[`frontend/src/components/ui/tooltip.tsx`](../../frontend/src/components/ui/tooltip.tsx)**

- `TooltipProvider` ([l.7](../../frontend/src/components/ui/tooltip.tsx#L7)) — Fournit le délai d'affichage commun des info-bulles.
- `Tooltip` ([l.21](../../frontend/src/components/ui/tooltip.tsx#L21)) — Info-bulle (racine).
- `TooltipTrigger` ([l.26](../../frontend/src/components/ui/tooltip.tsx#L26)) — Élément qui déclenche l'info-bulle.
- `TooltipContent` ([l.31](../../frontend/src/components/ui/tooltip.tsx#L31)) — Contenu positionné de l'info-bulle.

**[`frontend/src/features/settings/ThemeSync.tsx`](../../frontend/src/features/settings/ThemeSync.tsx)**

- `resolveTheme` ([l.6](../../frontend/src/features/settings/ThemeSync.tsx#L6)) — Résout le thème « system » en clair/sombre selon la préférence du système.
- `applyTheme` ([l.16](../../frontend/src/features/settings/ThemeSync.tsx#L16)) — Applique la classe `dark` sur <html> selon le thème résolu.
- `ThemeSync` ([l.22](../../frontend/src/features/settings/ThemeSync.tsx#L22)) — Synchronise thème, couleur d'accent, arrondi et favicon avec le store et le DOM.

**[`frontend/src/features/settings/favicon.ts`](../../frontend/src/features/settings/favicon.ts)**

- `cssColor` ([l.1](../../frontend/src/features/settings/favicon.ts#L1)) — Lit une variable CSS du thème courant (déjà résolue : couleur d'accent + thème clair/sombre).
- `buildFaviconSvg` ([l.9](../../frontend/src/features/settings/favicon.ts#L9)) — Même dessin que public/favicon.svg (carré arrondi + « >_ »), aux couleurs du thème de l'utilisateur.
- `syncFavicon` ([l.20](../../frontend/src/features/settings/favicon.ts#L20)) — Remplace l'icône de l'onglet par un SVG à la couleur principale choisie (et adapté au thème clair/sombre).

**[`frontend/src/features/settings/settingsSlice.ts`](../../frontend/src/features/settings/settingsSlice.ts)**

- `setTheme` ([l.42](../../frontend/src/features/settings/settingsSlice.ts#L42)) — Change le thème (clair, sombre, système).
- `setAccent` ([l.53](../../frontend/src/features/settings/settingsSlice.ts#L53)) — Change la couleur d'accent.
- `setRadius` ([l.57](../../frontend/src/features/settings/settingsSlice.ts#L57)) — Change l'arrondi des composants.
- `hydrateSettings` ([l.62](../../frontend/src/features/settings/settingsSlice.ts#L62)) — Charge les réglages enregistrés en base pour l'utilisateur connecté (source de vérité).

**[`frontend/src/hooks/use-mobile.ts`](../../frontend/src/hooks/use-mobile.ts)**

- `subscribe` ([l.6](../../frontend/src/hooks/use-mobile.ts#L6)) — S'abonne aux changements du media query « écran mobile » (< 768 px).
- `useIsMobile` ([l.13](../../frontend/src/hooks/use-mobile.ts#L13)) — Hook indiquant si l'écran est de taille mobile (alimente le comportement responsive de la sidebar).

**[`frontend/src/layouts/DashboardLayout.tsx`](../../frontend/src/layouts/DashboardLayout.tsx)**

- `DashboardLayout` ([l.15](../../frontend/src/layouts/DashboardLayout.tsx#L15)) — Mise en page de l'application connectée : sidebar, en-tête, zone de page avec Suspense (loader à chaque navigation) et pied de page légal.

**[`frontend/src/lib/utils.ts`](../../frontend/src/lib/utils.ts)**

- `cn` ([l.4](../../frontend/src/lib/utils.ts#L4)) — Fusionne des classes CSS conditionnelles (clsx) en résolvant les conflits Tailwind (tailwind-merge) : utilitaire de base de tous les composants.

**[`frontend/src/pages/NotFound.tsx`](../../frontend/src/pages/NotFound.tsx)**

- `NotFound` ([l.7](../../frontend/src/pages/NotFound.tsx#L7)) — Page 404 : même ambiance « terminal » que le logo et l'écran de chargement.

**[`frontend/src/pages/Settings.tsx`](../../frontend/src/pages/Settings.tsx)**

- `SectionTitle` ([l.34](../../frontend/src/pages/Settings.tsx#L34)) — Titre de section des réglages.

### Base de données

**[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)**

- `ThemePreference` ([l.128](../../backend/prisma/schema.prisma#L128)) — Préférence de thème (clair, sombre, système).
- `AccentPreference` ([l.143](../../backend/prisma/schema.prisma#L143)) — Couleur d'accent du design system.
- `RadiusPreference` ([l.156](../../backend/prisma/schema.prisma#L156)) — Arrondi des composants.

### Autres fichiers liés

- `frontend/src/index.css` — Tokens CSS : couleurs claires/sombres, accents, arrondis, animations.
- `frontend/components.json` — Configuration de la bibliothèque de composants.

## Comment le démontrer

- Changer thème, couleur d'accent et arrondi dans Réglages : toute l'UI suit instantanément.
