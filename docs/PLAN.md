# Plan — ft_transcendence (Babyfoot 42 Paris)

Document de travail équipe. Le `README.md` racine (anglais, éval 42) est fait. Pour l'implémentation détaillée : [`docs/team/`](./team/) — un doc par membre de l'équipe ([`demane.md`](./team/demane.md) : socle web ; [`rdinis.md`](./team/rdinis.md) : Tables & Queue ; [`rbourdon.md`](./team/rbourdon.md) : Match & Elo ; [`vicli.md`](./team/vicli.md) : Tournois ; [`bbouarab.md`](./team/bbouarab.md) : Gamification), qui couvrent ensemble tout le projet.

Objectif note : **125%** = **14 pts modules + 5 pts bonus**.

## Produit

Pas un Pong. Un site pour les **2 babyfoot de 42 Paris** :

- Login Intra 42 (email / mot de passe reste obligatoire pour le sujet).
- Voir si un baby est **libre ou occupé**.
- Si occupé : **file d’attente**.
- **Classement** + défi : depuis le classement, tu défies quelqu'un en 1v1 ou 2v2 (indépendant des tables), il accepte, une équipe entre le score, **au moins 1 joueur adverse valide**.
- **Elo** : battre un mieux classé rapporte plus que l’inverse.
- **Tournois** : un admin crée un tournoi (1v1 ou 2v2, aller simple ou aller-retour), inscrit des joueurs, tire le tableau au sort et le lance. Le moteur gère seul l'attribution des tables (les 2 tables sont libérées et occupées automatiquement par les rencontres du tournoi au fur et à mesure), un nombre de points fixe par tour (pas relatif au classement) s'ajoute au même Elo.

Le babyfoot est physique. On **ne claim pas** les modules Gaming (jeu web, remote, tournoi, spectator, stats de match du sujet). L’Elo et les tournois sont des features produit (organisation des babyfoot physiques), pas les modules « Tournament » / « Game statistics » du sujet (qui concernent le mini-jeu Pong).

## Répartition

Règle : **toi = le autour (socle web)**. **Les mates = le babyfoot**, chacun une feature complète (Prisma → route Nest → page React). Review des PR, pas de réécriture.

À l’éval, tout le monde explique le projet. Rôles (PO / PM / Tech Lead) à coller dans le README.

### Socle (autour) — ~10 pts faits (HTTPS inclus)

Auth email, OAuth 42, JWT, 2FA, profil, avatar, amis, i18n EN/FR/ES, thème, Docker, Prisma, presence online, chat (conversations, messages, blocages, non lus, temps réel).

Reste à finir **avant** que les mates branchent le métier :

1. ✅ Presence online (WebSocket, multi-onglets, sync amis).
2. ✅ **HTTPS + cookies `secure`** — `docker compose up` sert tout en HTTPS sur **https://localhost:8443** (nginx, certificat auto-signé généré au premier démarrage : accepter l'avertissement Chrome). Une seule origine : site à la racine, API sous `/api`, websockets en `wss://…/api/socket.io`. Le backend n'est plus exposé en direct. HTTP (8080) redirige vers HTTPS. **À faire côté intra 42** : ajouter `https://localhost:8443/api/auth/42/callback` dans les Redirect URI de l'app.
3. ✅ Privacy Policy + Terms of Service + liens en pied de page (`/privacy`, `/terms`, accessibles connecté ou non). Textes rédigés génériques : **à relire / adapter** avant l'éval (pas de page « placeholder »).
4. ✅ Polish 2FA (secret pending, wipe à la désactivation) + thème / langue persistés en base.
5. ✅ Gateways WebSocket + auth socket (`/presence`, `/chat`). Les mates peuvent ajouter tables / queue / notifs.
6. ✅ README racine (anglais) — [`README.md`](../README.md).

Fait en plus (hors liste initiale) : refonte UI **Phosphor** (maquette : thème sombre monospace, dashboard, réglages, saisie 2FA en 6 cases, amis en ligne / hors ligne, aperçu de profil), blocage d'utilisateurs, messages non lus persistants (point sur « Chat » + badge par conversation).

### Produit — mates (une personne = une slice)

Ordre :

1. ✅ **Tables** — 2 baby, libre / occupé, page live.
2. ✅ **Queue** — s’inscrire (solo), ordre FIFO, notif « à toi » (websocket + toast + point de nav), timeout 2 min si tu ne prends pas la table (le suivant est appelé automatiquement).
3. ✅ **Match** — défi depuis le classement (1v1 ou 2v2, indépendant des tables), saisie du score + validation par 1 adversaire, litige si pas validé à temps.
4. ✅ **Elo** — classement (page dédiée), calcul serveur à la validation, K plus haut pour les nouveaux.
5. ✅ **Tournois** — création admin (1v1/2v2, aller-retour en option), tirage au sort, moteur d'attribution automatique des tables, points fixes par tour ajoutés au classement.
6. ✅ **Gamification (badges + XP)** — XP séparé de l'Elo (niveau tous les 100 XP), 7 badges (première victoire, 10 victoires, 50 matchs, série de 3, tombeur, finaliste, champion), affichés sur chaque profil avec notif temps réel à l'obtention.

Pair ~30 min au début de chaque feature, ensuite ils pushent.

## Pack modules 19 pts (125%)

Major = 2, minor = 1. Le bonus ne compte que si les **14** sont démoables.

### 14 pts (100%)

| Module                                         | Type  | Pts | Qui   | État                                   |
| ---------------------------------------------- | ----- | --- | ----- | -------------------------------------- |
| Frameworks FE + BE (React + NestJS)            | Major | 2   | Socle | ✅ Fait                                |
| ORM Prisma                                     | Minor | 1   | Socle | ✅ Fait                                |
| User management (profil, avatar, amis, online) | Major | 2   | Socle | ✅ Fait (presence incluse)             |
| OAuth 2.0 Intra 42                             | Minor | 1   | Socle | ✅ Fait                                |
| 2FA TOTP                                       | Minor | 1   | Socle | ✅ Fait                                |
| i18n 3 langues                                 | Minor | 1   | Socle | ✅ Fait                                |
| WebSockets temps réel                          | Major | 2   | Mates | ✅ Presence + chat + tables + queue + matchs + tournois en live |
| Interaction users (chat + profil + amis)       | Major | 2   | Socle | ✅ Fait (chat, profil, amis)           |
| Notifications CUD                              | Minor | 1   | Mates | ✅ Chat (non lus) + amis (demande) + queue (ton tour) + matchs (défi/score/résultat) + tournois (lancé/à jouer/éliminé/vainqueur) en toast/point |
| Gamification                                   | Minor | 1   | Mates | ✅ Leaderboard (classement Elo) + badges (7) + XP/niveau, sur chaque profil |

### +5 bonus (125%)

| Module                                     | Type  | Pts | Note                                        |
| ------------------------------------------ | ----- | --- | ------------------------------------------- |
| GDPR                                       | Minor | 1   | Export / suppression compte / confirmation  |
| PWA                                        | Minor | 1   | Install tel, voir si un baby est libre      |
| Autres navigateurs (Firefox + Safari/Edge) | Minor | 1   | Tester et documenter                        |
| Healthcheck + backups                      | Minor | 1   | Status page + dump Postgres                 |
| Recherche avancée                          | Minor | 1   | Joueurs / matchs : filtres, tri, pagination |

Filet si un module tombe : API publique (2), permissions admin (2), dashboard analytics (2), file upload complet (1), chat avancé (1). Viser 16–19 implémentés pour en valider 19.

### Modules bonus « filet » validés

- ✅ **Chat avancé (minor, 1 pt)** — blocage, historique persistant, accès au profil depuis le chat (lien dans l'en-tête de conversation), indicateurs de frappe (WebSocket `typing`, timeout 3 s), accusés de lecture temps réel (simple check / double check, événement `conversation:read`). Inviter à jouer depuis le chat : bouton « Défier » (même dialogue 1v1 / 2v2 que le classement) dans l'en-tête de conversation, plus un bouton « Inviter aux échecs » à brancher quand le jeu d'échecs sera intégré (point d'entrée : `frontend/src/features/chess/useChessInvite.ts`).
- ✅ **Design system maison (minor, 1 pt)** — documenté dans [`docs/DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) : palette (tokens clair/sombre), typographie (JetBrains Mono), icônes (lucide-react), 14 composants réutilisables listés avec variantes et usages.

### Suivi du reste (bonus)

- ✅ **Healthcheck + backups (minor, 1 pt)** — `/health`, page `/status`, healthchecks Docker, service `backup` (pg_dump toutes les 24 h, rétention 7 j), restauration transactionnelle. Voir [`BACKUP.md`](./BACKUP.md).
- ✅ **Recherche avancée (minor, 1 pt)** — historique des matchs (joueur, résultat, format, origine, tri) et classement (joueur, périmètre amis, matchs minimum, tri), pagination côté serveur ; le rang affiché reste le rang général.
- ✅ **GDPR (minor, 1 pt)** — export des données en CSV ou JSON (`GET /gdpr/export?format=`), suppression du compte avec lien de confirmation par email (`/gdpr/deletion-request` puis `/gdpr/deletion-confirm`) : les données personnelles sont effacées et le compte est **anonymisé** (« Deleted user », colonne `User.deletedAt`) pour préserver l'historique, l'Elo et les tournois des autres joueurs, emails de confirmation (nodemailer, Mailpit en dev sur http://localhost:8025), section « Confidentialité & données » dans les réglages.
- Restent (filet) : PWA, autres navigateurs.

## Abordable plus tard (pas dans le pack)

API publique, permissions CRUD / rôles, organisations (clans), analytics user, WCAG AA, RTL, dashboard analytics, export/import, WAF+Vault, ELK, Grafana, microservices, chat avancé, file upload complet.

## À ne pas claim

Jeu web, remote players, tournoi *du sujet* (bracket du mini-jeu Pong), spectator, customisation de jeu, IA opponent, 2e jeu, 3D, stats de match (module sujet), scores tournoi blockchain, backend ICP. (Notre tournoi babyfoot est une feature produit distincte, pas ce module.)

## Règles métier (v1)

- **Occupation** : honor system. Un joueur déclare occupé / libre. Pas d’IoT.
- **Queue** : un seul nom par entrée (solo). Rejoindre la file ne dit rien sur qui va jouer avec qui : ça se décide via un match (défi) séparé.
- **Match** : indépendant des tables. Défi depuis le classement, 1v1 ou 2v2 choisi à la proposition ; en 2v2 chaque camp choisit son propre coéquipier (le proposeur à la création, le défié à l'acceptation). N'importe quel joueur du match soumet le score, il faut 1 joueur de l'autre équipe pour valider. Sans validation sous 10 min : litige, pas d'Elo.
- **Elo** : rating individuel (départ 1000), moyenne d'équipe pour l'expected score, même delta pour les deux coéquipiers. K plus haut (40) pour les nouveaux (< 10 matchs), 20 ensuite. Calcul **côté serveur**, appliqué à la validation.
- **Tournoi** : admin only. Format (1v1/2v2) et aller-retour choisis à la création ; nombre de participants imposé en puissance de 2 (4, 8, 16…). Tirage au sort aléatoire au lancement. Points fixes par tour (10 × numéro du tour), gagnés uniquement par le vainqueur de chaque rencontre, ajoutés au même Elo — pas de calcul relatif au classement pour les tournois. Aller-retour : agrégat des 2 manches, belle (3e manche) si égalité. Litige sur une manche de tournoi → rejouée automatiquement (pas de forfait). Au lancement, les 2 tables sont libérées de force (l'occupant précédent est notifié) et leur file d'attente vidée ; elles restent réservées au tournoi (occupy/queue bloqués) jusqu'à ce qu'il n'ait plus besoin d'elles. **Un seul tournoi actif à la fois** : lancer un tournoi alors qu'un autre est en cours le met en **file d'attente** (statut `QUEUED`, inscriptions figées) ; il démarre tout seul (tirage, tables, notifications) dès que le tournoi en cours est terminé ou annulé, dans l'ordre de la file. Annuler un tournoi libère ses tables, clôt ses manches en cours (litige) et fait démarrer le suivant. Une table réservée par un tournoi est toujours affichée occupée (accueil et page Tables).
- **Gamification** : XP gagné à chaque match joué (10, +20 si victoire, +50 bonus pour remporter tout un tournoi), niveau = XP/100. 7 badges à débloque automatiquement (première victoire, 10 victoires, 50 matchs, série de 3 victoires, tombeur = battre un adversaire avec 150+ de rating d'avance, finaliste et champion de tournoi). Un badge ne se débloque qu'une fois (contrainte unique), notifié en temps réel.
- **Tables seed** : Baby A / Baby B (42 Paris).

Hors scope v1 : capteurs, réservation à l’avance, admin CRUD complet.

## Modèle (implémenté)

- `Table` — id, name, status FREE/BUSY, occupiedById, occupiedAt, currentTournamentTieId
- `QueueEntry` — tableId, requesterId, status, joinedAt, calledAt, expiresAt
- `Match` — format (1v1/2v2), status, teamA (1-2 joueurs), teamB (1-2 joueurs), scoreA/B, submittedBy, validatedBy, + tournamentTieId/legNumber/tableId si c'est une manche de tournoi
- `User.rating` (Elo, défaut 1000), `User.matchesPlayed`
- `Tournament` — name, format, twoLegged, status (DRAFT/IN_PROGRESS/COMPLETED/CANCELLED), totalRounds, createdBy
- `TournamentEntry` — une place dans le tableau (1 ou 2 joueurs), seed
- `TournamentTie` — une rencontre (round/slot), entryA/B, status, winnerEntryId, pointsAwarded ; ses manches sont des `Match`
- `User.xp`, `User.wins`, `User.currentWinStreak`, `User.bestWinStreak` ; `UserBadge` — userId + code (unique), earnedAt

Un gateway WebSocket par domaine (presence, chat, tables, queue, matches, tournaments, badges), même pattern (JWT au handshake, room par utilisateur).

## Checklist obligatoire du sujet (rejet si manquant)

| Exigence                                                          | État |
| ----------------------------------------------------------------- | ---- |
| Web app front + back + base de données                            | ✅   |
| Déploiement conteneurisé, une seule commande                      | ✅ (`docker compose up`) |
| Compatible Chrome, **aucune erreur / warning console**            | ✅ vérifié sur toutes les pages (desktop + mobile) |
| Privacy Policy + Terms of Service accessibles, contenu pertinent  | ✅ (à relire) |
| Multi-utilisateurs simultanés, mises à jour temps réel            | ✅ (presence + chat) ; à re-vérifier avec tables / queue |
| Front responsive et accessible                                    | ✅ mobile vérifié ; accessibilité clavier / ARIA à auditer |
| Framework CSS (Tailwind)                                          | ✅   |
| Secrets dans `.env` ignoré par git + `.env.example`               | ✅   |
| Schéma BDD clair avec relations                                   | ✅ (Prisma, migrations) |
| Email + mot de passe hashé (bcrypt)                               | ✅   |
| Validation des formulaires **front et back**                      | ✅ (zod + class-validator) |
| **HTTPS pour toute connexion navigateur → backend**               | ✅ (nginx TLS, `docker compose up`) |
| Commits de **tous** les membres, répartition du travail visible   | ⚠️ Historique actuel : un seul contributeur (2 identités git, même email). Les mates doivent pusher leurs features. |

## Prochaines étapes (ordre conseillé)

Les mates ne font pas de web : le produit babyfoot est porté par l'équipe web (front + back), une slice complète à la fois (Prisma → route Nest → page React).

1. ✅ **Tables** — 2 baby (seed Baby A / Baby B), libre / occupé (honor system), page live en WebSocket (`/tables`), prise atomique (pas de course), carte sur l'accueil.
2. ✅ **Queue** — solo, FIFO par table, notif « à toi » (WebSocket `/queue`, toast, point de nav sur Tables), timeout 2 min (le suivant est appelé automatiquement), table réservée pendant le délai (bloque les autres).
3. ✅ **Match + Elo** — page Classement (`/ranking`) et page Défis (`/challenges`) séparées, défi 1v1/2v2 depuis le classement ou le chat (indépendant des tables), accept/decline, saisie + validation du score par l'adversaire, litige auto après 10 min sans validation, Elo appliqué côté serveur à la validation. Notifs temps réel (WebSocket `/matches`, toasts, point de nav sur Défis).
4. ✅ **Tournois** — page `/tournaments`, création admin (nom, format, aller-retour), inscription des participants (recherche de joueurs, paires pour le 2v2), tirage au sort au lancement, moteur d'attribution automatique des tables (libération forcée + file vidée au lancement, occupation/libération à chaque manche), points fixes par tour ajoutés au classement, bracket affiché par tour avec score cumulé pour l'aller-retour. Notifs temps réel (WebSocket `/tournaments`).
5. ✅ **Gamification (badges + XP)** — carte « Progression » sur chaque profil (le sien et celui des autres) : barre XP/niveau, stats (victoires, matchs joués, meilleure série), grille des 7 badges (colorés si obtenus, grisés + cadenas sinon). Notif temps réel (WebSocket `/badges`) à chaque déblocage.
6. ✅ Chat avancé (+1 pt) et design system documenté (+1 pt, voir [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)).
7. Bonus : GDPR, healthcheck + backup, PWA, tests navigateurs.
8. ✅ README racine en anglais (rôles, modules claimés, stack). Reste : relire Privacy / Terms avant l'éval.
