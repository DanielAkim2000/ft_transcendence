# Design system — ft_transcendence

Design system maison ("Phosphor") : palette, typographie, icônes et bibliothèque de composants réutilisables construits sur [Base UI](https://base-ui.com/) + [Tailwind CSS v4](https://tailwindcss.com/) (via `shadcn`, restylés). Objectif du sujet : palette + typo + icônes + **≥ 10 composants réutilisables**, documentés.

## Palette

Tokens définis en variables CSS dans [`frontend/src/index.css`](../frontend/src/index.css), un thème clair (`:root`) et un thème sombre (`.dark`), exposés à Tailwind via `@theme inline`.

| Token               | Clair (`:root`) | Sombre (`.dark`) | Usage                                  |
| ------------------- | ---------------- | ------------------ | --------------------------------------- |
| `--background`      | `#f4f1ea` (crème) | `#07090a` (quasi noir) | Fond de page                       |
| `--foreground`      | `#15181a`         | `#e6f2ea`           | Texte principal                        |
| `--card`             | `#fbf9f4`         | `#0b1011`           | Fond des cartes / panneaux             |
| `--primary`          | `#1f9d55` (vert)  | `#3ddc84` (vert phosphor) | Actions principales, focus, liens |
| `--secondary`        | `#e9e5da`         | `#16181a`           | Boutons secondaires                    |
| `--muted` / `-foreground` | `#e9e5da` / `#5d6f6a` | `#16181a` / `#7d928c` | Textes / fonds discrets        |
| `--accent`           | `#e2ede5`         | `#1e2a2b`           | Survol, sélection                      |
| `--destructive`      | `#d9480f` (orange brûlé) | `#ff6b3d`     | Erreurs, actions destructives          |
| `--border` / `--input` | `#d6d0c4`       | `#1e2a2b` / `#2c3c3a` | Bordures, champs de formulaire     |
| `--chart-1..5`       | dégradé vert/orange | idem, plus lumineux | Graphiques (progression XP, stats) |
| `--sidebar*`         | dérivés du thème  | dérivés du thème    | Navigation latérale                    |

Chaque paire clair/sombre est reprise automatiquement par tous les composants (aucune classe `dark:` codée en dur composant par composant, sauf exceptions ponctuelles) grâce aux tokens.

**Rayon (`--radius`) = `0`** : partout dans l'app les angles sont droits (esthétique "terminal / brutaliste"), y compris sur les boutons, cartes, inputs — un choix de direction artistique assumé, pas un oubli.

## Typographie

Une seule famille dans toute l'app : **JetBrains Mono Variable** (`@fontsource-variable/jetbrains-mono`), appliquée via `--font-sans`, `--font-heading`, `--font-mono`, `--font-serif` (tout pointe vers la même police monospace). Rendu "console / terminal" cohérent avec le nom du produit (`>_ TRANSCENDENCE`).

Échelle : classes utilitaires Tailwind standard (`text-xs` → `text-3xl`), poids `font-medium` / `font-semibold` / `font-bold`, titres de section en `uppercase tracking-[0.2em] text-xs text-muted-foreground` (voir en-têtes de `Chat`, `Tables`, `Tournaments`).

## Icônes

[`lucide-react`](https://lucide.dev/) exclusivement (aucune autre lib d'icônes). Utilisé dans 7+ features (chat, tables, tournois, badges, sidebar, dialogues de confirmation…). Toujours en `size-3` à `size-5` selon le contexte, jamais de taille par défaut non contrôlée.

## Composants réutilisables (`frontend/src/components/`)

14 composants UI génériques (`components/ui/`) + 2 composants composites (`components/`) = **16 composants réutilisables** (le minimum demandé par le sujet est 10), chacun utilisé par au moins 2 features différentes.

| Composant | Fichier | Rôle / variantes | Utilisé dans |
| --- | --- | --- | --- |
| **Button** | `ui/button.tsx` | 6 variantes (`default`, `outline`, `secondary`, `ghost`, `destructive`, `link`) × 8 tailles (`default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`), basé sur `class-variance-authority` | Partout (formulaires, actions, nav) |
| **Input** | `ui/input.tsx` | Champ texte stylé, focus-ring, état `aria-invalid` | Login, Register, Chat, Profil, création de tournoi |
| **Label** | `ui/label.tsx` | Libellé de champ accessible (lié via `htmlFor`) | Tous les formulaires |
| **Field** | `ui/field.tsx` | Groupe label + input + message d'erreur, gère la validation front | Login, Register, Settings, 2FA |
| **Card** | `ui/card.tsx` | Conteneur (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) | Profil, Badges, Tables, Tournois, Dashboard |
| **Avatar** | `ui/avatar.tsx` | `Avatar` / `AvatarImage` / `AvatarFallback` (initiales si pas d'image) | Sidebar, Chat, Profil, Amis, Classement |
| **CodeInput** | `ui/code-input.tsx` | Saisie de code à 6 cases séparées, navigation clavier auto | Activation 2FA |
| **RadioGroup** | `ui/radio-group.tsx` | Sélecteur à choix unique accessible (clavier + ARIA) | Création de tournoi (format 1v1/2v2, aller simple/retour) |
| **Separator** | `ui/separator.tsx` | Ligne de séparation horizontale/verticale | Sidebar, formulaires, menus |
| **Sheet** | `ui/sheet.tsx` | Panneau latéral coulissant (drawer), overlay + focus trap | Sidebar mobile |
| **Sidebar** | `ui/sidebar.tsx` | Système de navigation latérale complet (collapsible, responsive, `SidebarProvider`) | Layout principal (`DashboardLayout`) |
| **Skeleton** | `ui/skeleton.tsx` | Placeholder de chargement animé | Listes (conversations, classement, tournois) en cours de chargement |
| **Toast** | `ui/toast.tsx` | Notifications éphémères (`toast.add({ title, type })`), typée succès/erreur/info | Toutes les features temps réel (chat, queue, matchs, tournois, badges) |
| **Tooltip** | `ui/tooltip.tsx` | Infobulle au survol/focus | Icônes seules (boutons icon-only), badges verrouillés |
| **ConfirmDialog** | `confirm-dialog.tsx` | Modale de confirmation générique (`title`, `description`, `confirmLabel`, variante destructive) | Blocage utilisateur, déconnexion, désinscription tournoi, suppression |
| **LegalLinks** | `legal-links.tsx` | Liens Privacy/Terms réutilisés en pied de page | Pages publiques et privées |

Tous les composants sont **headless-first** (comportement accessible fourni par [Base UI](https://base-ui.com/) : focus management, ARIA, clavier) puis stylés avec les tokens ci-dessus via `class-variance-authority` + `tailwind-merge` (`cn()` dans `lib/utils.ts`), ce qui garantit qu'un changement de thème (clair/sombre) ou de palette se répercute automatiquement sans toucher aux composants.

## Où voir le thème en action

- `/settings` : bascule clair / sombre / système, persistée en base (`User.theme`).
- N'importe quelle page : la palette, la typo et les composants ci-dessus sont utilisés de façon cohérente (aucun style ad-hoc en dehors de ce système, sauf mise en page ponctuelle avec les utilitaires Tailwind).
