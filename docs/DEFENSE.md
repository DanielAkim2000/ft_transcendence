# Guide de soutenance — ft_transcendence

Ce guide suit **l'ordre de la grille d'évaluation** et propose, pour chaque rubrique : *quoi montrer*, *quoi dire*, *où c'est dans le code*, et *notre verdict* (✅ on valide · ⚠️ à vérifier/corriger avant · ❌ ne pas revendiquer). Les fiches détaillées de chaque module sont dans [`docs/modules/`](modules/README.md) ; dans le code, cherchez le tag du module (ex. `[Minor · 2FA]`).

> Les verdicts viennent d'une lecture du dépôt et de tests de typage/lint/clone. **Rien n'a été testé dans un navigateur Chrome** : les points « console » et « responsive » doivent être vérifiés à la main (checklist en section 0).

---

## 0. Avant l'évaluation (checklist — 30 min)

À faire **dans un dossier vide**, comme l'évaluateur (la grille demande un `git clone` propre).

| ☐ | Action | Pourquoi |
|---|---|---|
| ☐ | `git clone <repo> && cd ft_transcendence && make setup && make prod` | Déploiement en une commande. `make setup` crée `.env.dev`/`.env.prod` et génère des secrets aléatoires (le script a été corrigé : avant, un clone neuf échouait faute de modèles de secrets). |
| ☐ | Mettre le vrai `CLIENT_ID` dans `.env.prod`, le vrai secret 42 dans `secrets/client_secret` | Sinon « Se connecter avec 42 » échoue. |
| ☐ | Sur le site de 42, enregistrer **`https://localhost:8443/api/auth/42/callback`** (prod) et `http://localhost:5000/auth/42/callback` (dev) | « The redirect uri included is not valid » sinon. |
| ☐ | **Régénérer les secrets JWT** : `openssl rand -hex 32 > secrets/jwt_refresh_token_secret` (idem `jwt_pre_auth_token_secret`, `jwt_access_token_secret`) | Sur votre machine, `jwt_refresh_token_secret` et `jwt_pre_auth_token_secret` valent encore les placeholders publics de l'historique git (`jwt_refresh_secret`…). Un clone neuf, lui, génère des valeurs aléatoires. |
| ☐ | Ouvrir **Chrome en navigation privée**, DevTools → Console, filtres *Errors* + *Warnings*, charger chaque page | Critère « aucune erreur ni warning dans la console ». En prod, les `console.*` sont supprimés du build. L'avertissement de certificat auto-signé est attendu (cliquer « Avancé → continuer »). |
| ☐ | Tester à 375 px (mobile) et 1280 px | Critère responsive (voir 3.1). |
| ☐ | Lire la section « Mailpit » du README : boîte mail de test sur http://localhost:8025 | Pour montrer reset de mot de passe, RGPD, ban. |
| ☐ | Mettre à jour le **README** (voir « Écarts connus » en fin de document) | Il est la source officielle de l'évaluateur. |
| ☐ | Avoir deux navigateurs/profils connectés avec deux comptes (+ un admin) | Presque toutes les démos sont à deux utilisateurs. |

**Comptes de démo** (mot de passe `Test1234!`, recréés à chaque démarrage) : `admin@ft.local` (ADMIN) et des comptes `prenom.nom@ft.local` (ex. `lucas.moreau@ft.local`, `emma.lefebvre@ft.local`…). Le README parle encore de `alice@`/`bob@` : à corriger.

---

## 1. Préliminaires

### 1.1 Présence de l'équipe et contributions individuelles
- Tout le monde est là, chacun explique **son rôle + une fonctionnalité qu'il a codée**. Préparez 1 minute par personne : *rôle (PO/PM/Tech Lead/Dev) → fonctionnalité → fichier précis à ouvrir*.
- Répartition annoncée par le README : demane (socle, auth, users, chat…), rdinis (Tables & file), rbourdon (Matchs & Elo), vicli (Tournois), bbouarab (Gamification). Chaque responsable ouvre les fichiers de sa tranche (voir les fiches `docs/modules/`, section « Fichiers concernés »).

### 1.2 README complet — ✅ avec une réserve
Les 8 sections demandées existent : description, équipe et rôles, gestion de projet, stack et justifications, schéma de base, liste de fonctionnalités, modules, contributions individuelles. ⚠️ La section **Modules** est périmée (voir « Écarts connus »).

### 1.3 Cohérence du projet — à répéter à plusieurs
Pitch en 30 s : *« Application web d'organisation des deux babyfoot physiques de l'école (file d'attente, matchs, Elo, tournois, badges) enrichie d'un jeu d'échecs en ligne en 3D avec IA, chat, amis et administration. »* Stack : React 19 + NestJS 11 + PostgreSQL/Prisma, WebSockets Socket.IO, Docker/nginx HTTPS. Organisation : une fonctionnalité = un responsable, de la base à l'écran, revue par le Tech Lead.

### 1.4 Historique Git — ⚠️ à préparer
`git shortlog -sn --all` montre 6 auteurs, dont un en fait 49 commits sur ~91 (≈ 54 %) et un auteur à 1 seul commit. Les **noms d'auteur git** (`vicli`, `rudyDinis`, `cacheoeil`, `prunno`, `alcorcamel`) ne correspondent pas aux **logins du README** (`demane`, `rdinis`, `rbourdon`, `bbouarab`). Prévoyez un tableau « auteur git → membre → ce qu'il a fait » et assurez-vous que **chaque membre a des commits significatifs** (un membre sans commit = « Teamwork » refusé).

---

## 2. Exigences générales

### 2.1 Trois composants — ✅
Frontend `frontend/` (React), backend `backend/` (NestJS), base PostgreSQL (service `db`). Montrer `docker-compose.yml` et `docker compose ps`.

### 2.2 Déploiement en une commande — ✅ (après correction)
`make setup && make prod` (voir checklist). Montrer que tous les services passent *healthy* (`make ps ENV=prod`), puis ouvrir https://localhost:8443. Points à dire : nginx sert le front et proxifie `/api` (REST) et `/api/socket.io` (WebSockets) vers le backend, certificat auto-signé généré au premier démarrage, la base est dans un volume nommé, un conteneur `backup` sauvegarde la base.

### 2.3 Chrome sans erreur ni warning — ⚠️ vérifier à la main
Ce qui est en place : `console.*` supprimés du build de production (`frontend/vite.config.ts`), pas d'appel `/auth/refresh` sans session (pas de 401 en console), avertissement WebGL Firefox corrigé (ombres VSM), fermeture propre des sockets. À tester : une visite complète (login, chess, chat, tables, admin) en navigation privée. Les messages natifs du navigateur (requête réseau échouée, certificat) ne sont pas supprimables : la conduite est de **ne pas déclencher d'erreur réseau** pendant la démo.

### 2.4 Politique de confidentialité et CGU — ✅
Pages publiques `/privacy` et `/terms` (6 sections chacune, traduites), liens dans le pied de page (`LegalLinks`) y compris sur les écrans de connexion. Ouvrez-les sans être connecté.

---

## 3. Exigences techniques

| Critère | Verdict | À montrer / dire |
|---|---|---|
| **3.1 Responsive** | ✅ (tester) | Réduire la fenêtre à 375 px : la sidebar devient un panneau coulissant (`Sheet`, `useIsMobile`), l'échiquier 3D reste centré et entier (le canvas prend 100 % du conteneur), les listes s'empilent. |
| **3.2 Solution de style** | ✅ | **Tailwind CSS 4** + tokens CSS (`index.css`) + composants maison. Ouvrir un composant (`components/ui/button.tsx`, variantes `cva`). |
| **3.3 Variables d'environnement** | ✅ | `.env.dev`/`.env.prod` et `secrets/*` sont dans `.gitignore` ; `.env.example` est fourni ; seuls des placeholders (`.gitkeep`, anciens `*.example`) ont existé dans l'historique. Montrer `git ls-files | grep -E "(^|/)\.env|secrets/"` → uniquement `.env.example` et `secrets/.gitkeep`. ⚠️ ne laissez aucun secret réel dans le README ou les captures. |
| **3.4 Schéma de base** | ✅ | `backend/prisma/schema.prisma` (chaque modèle est commenté avec son module) et section « Database Schema » du README. Expliquer les relations clés : User ↔ Friendship, Conversation/Message, Match ↔ Tournament(Tie), ChessGame ↔ ChessMove. |
| **3.5 Authentification sécurisée** | ✅ | Mots de passe : **bcrypt (coût 10, sel intégré)**, jamais en clair. Refresh tokens : cookie httpOnly, stockés **hachés SHA-256**, rotation à chaque usage. Access token JWT 1 h en mémoire seulement. Montrer `register`/`createTokens` dans `auth.service.ts` et la colonne `passwordHash` en base. |
| **3.6 Validation des formulaires** | ✅ | Front : **Zod** + TanStack Form (messages traduits). Back : `ValidationPipe` global avec `whitelist` + `forbidNonWhitelisted` et DTO `class-validator`. Démo : champ vide, email invalide, mot de passe faible, `' OR 1=1 --` (requêtes **paramétrées Prisma**), `<script>alert(1)</script>` dans le chat (React échappe le texte). Montrer qu'une requête directe (curl) avec champ inconnu est refusée en 400. |
| **3.7 HTTPS** | ✅ en production | `make prod` : tout passe par nginx en TLS (`https://localhost:8443`, WebSockets en `wss://`) ; le backend n'est pas exposé. Le mode dev est volontairement en HTTP. Expliquer l'avertissement du certificat auto-signé. |

---

## 4. Modules — comment présenter, dans un ordre logique

### 4.1 Total de points et stratégie
Il faut **14 points validés** ; le bonus est plafonné à **5 points** et n'est évalué que si tout le reste est parfait. Nous avons **29 points** documentés (8 Major + 13 Minor) : le surplus est un filet de sécurité. Proposition :

| Rôle | Modules | Pts |
|---|---|---|
| **Les 14 requis** (les plus solides, démontrables sans risque) | Frameworks (2) · WebSockets (2) · Interaction users (2) · Gestion users (2) · Permissions (2) · ORM (1) · Multilingue (1) · OAuth 42 (1) · 2FA (1) | 14 |
| **Bonus (5 max)** | Jeu d'échecs (2) · Adversaire IA (2) · Chat avancé (1) | 5 |
| **Réserve si un module tombe** | Graphismes 3D (2) · Notifications · Design system · Recherche · Stats/historique · Tournois · Gamification · Health · RGPD | +11 |

> Conseil : **déclarez dans le README tout ce que vous démontrez**, même au-delà de 19 points ; l'évaluateur ne compte que ce qui fonctionne. Les modules à *dépendance* (IA, stats, tournois, chat avancé) exigent un jeu / le chat de base : c'est le cas (échecs, chat).

### 4.2 Déroulé en un seul scénario (≈ 25 min)
Un fil rouge évite de sauter d'un module à l'autre. À chaque étape : **faire**, **dire**, **montrer le code**.

**Étape 1 — Inscription / connexion → modules « Gestion des utilisateurs », « Frameworks », « ORM »**
- Faire : s'inscrire (mot de passe faible refusé), se connecter, recharger (session restaurée), se déconnecter.
- Dire : JWT + refresh httpOnly tourné et haché, bcrypt, validation front/back.
- Code : `auth.service.ts` (`register`, `createTokens`, `rotateRefreshToken`), `AuthBootstrap.tsx`, `store/api.ts` (refresh automatique sur 401).
- Frameworks/ORM (30 s) : structure `controller → service → repository`, `schema.prisma`, une migration.

**Étape 2 — Profil, avatar, réglages → « Gestion des utilisateurs », « Multilingue », « Design system »**
- Faire : changer nom et avatar ; Réglages : langue EN/FR/ES, thème, couleur d'accent, arrondi ; recharger.
- Dire : réglages persistés par utilisateur, erreurs traduites par code, composants maison.
- Code : `ProfileMe.tsx`, `users.controller.ts` (`uploadAvatar`), `settingsSlice.ts`, `components/ui/`.

**Étape 3 — 2FA et OAuth 42 → « 2FA », « OAuth 42 »**
- Faire : activer la 2FA (QR code), se reconnecter avec le code, essayer un code de secours ; se connecter avec 42.
- Dire : TOTP (otplib), cookie de pré-authentification entre les deux étapes, codes de secours hachés à usage unique ; OAuth via passport-42 et cookie de refresh.
- Code : `auth.service.ts` (`generate2faSecret`, `verify2fa`, `useRecoveryCode`), `forty-two.strategy.ts`, `Login.tsx`, `AuthCallback.tsx`.

**Étape 4 — Amis et présence → « Interaction entre utilisateurs », « WebSockets »**
- Faire (2 navigateurs) : envoyer/accepter une demande d'ami (toast en direct), voir le statut en ligne basculer ; fermer un onglet puis l'autre.
- Dire : un namespace Socket.IO par domaine, room par utilisateur, multi-onglets géré, resynchronisation après reconnexion.
- Code : `presence.gateway.ts` (`handleConnection`, `notifyFriends`), `PresenceBootstrap.tsx`, `lib/socket.ts`.

**Étape 5 — Chat → « Interaction », « Chat avancé »**
- Faire : échanger des messages (indicateur de saisie, double check de lecture), bloquer puis débloquer, voir le profil depuis l'en-tête, **inviter aux échecs** (carte dans la conversation).
- Code : `chat.service.ts` (`sendMessage`, `blockUser`, `postChessInvite`), `chat.gateway.ts` (`handleTyping`), `ChatThread.tsx`, `ChessInviteCard.tsx`.

**Étape 6 — Notifications → « Notifications »**
- Faire : provoquer un défi/une demande d'ami → toast puis entrée dans `/notifications` avec pastille.
- Code : `notifications.service.ts`, `NotificationsBootstrap.tsx`, `notificationRender.ts`.

**Étape 7 — Échecs, 3D, IA → « Jeu web », « Graphismes 3D », « Adversaire IA »**
- Faire : accepter l'invitation, jouer quelques coups (surbrillance des coups légaux, rotation/zoom, promotion), abandonner ; lancer une partie contre l'IA niveau Facile puis Expert.
- Dire : serveur autoritaire (chess.js), coups diffusés en direct, mat/pat/répétition/matériel détectés ; scène Three.js (modèles procéduraux, ombres, orbite, raycasting) ; IA = négamax alpha-bêta + quiescence, faillible aux bas niveaux (bruit + coups aléatoires), calculée dans un worker.
- Code : `chess.service.ts` (`playMove`), `chess.gateway.ts` (`handleMove`), `ChessBoard3D.tsx`, `pieceModels.ts`, `chess-ai.ts` (`negamax`, `Searcher.search`).
- ⚠️ À savoir si on vous interroge : pas de pendule active ; la note/les stats d'échecs ne sont pas encore calculées en fin de partie.

**Étape 8 — Babyfoot : matchs, classement, historique, gamification, tournois → « Stats et historique », « Recherche avancée », « Gamification », « Tournois »**
- Faire : proposer un défi, saisir/valider un score, voir l'Elo et le badge/XP (toast), classement avec recherche/filtres/tri/pagination, historique filtré ; créer et lancer un tournoi à 4, avancer le tableau.
- Dire : Elo par équipe (K = 40 puis 20), XP 10/+20/+50, 7 badges, tableau à élimination directe (taille puissance de 2, aller-retour optionnel).
- Code : `elo.ts`, `matches.service.ts`, `badges.service.ts`, `bracket.ts`, `tournaments.service.ts` (`finishTie`), `users.repository.ts` (`listRanking`).
- ⚠️ Présentez ces mécaniques comme celles du **babyfoot de l'application** ; l'évaluateur peut objecter que le « jeu » du sujet est ici les échecs.

**Étape 9 — Administration → « Permissions avancées »**
- Faire (compte admin) : CRUD utilisateurs, changer un rôle, bannir puis débannir (le banni est expulsé en direct), gérer les tables ; montrer qu'un compte `USER` reçoit 403 et n'a pas le menu admin.
- Code : `roles.guard.ts`, `admin-users.service.ts`, `ban.service.ts`, `RequireAdmin.tsx`.

**Étape 10 — Statut, sauvegardes, RGPD → « Health check & backups », « RGPD »**
- Faire : ouvrir `/status` ; `make db-backup` puis `make db-backups` ; Réglages → exporter en CSV et JSON ; demander la suppression, ouvrir le lien dans Mailpit, confirmer (compte anonymisé, matchs des autres conservés).
- Code : `health.service.ts`, `scripts/db-backup.sh`, `gdpr.service.ts` (`eraseAccount`), `gdpr.csv.ts`.

Pour chaque module, la fiche `docs/modules/NN-….md` contient « ce que demande le sujet », la logique et la liste des fonctions à ouvrir.

### 4.3 Verdict module par module

| Module | Pts | Verdict | Note |
|---|---|---|---|
| Frameworks React + NestJS | 2 | ✅ | — |
| WebSockets | 2 | ✅ | Reconnexion explicite seulement pour tables/queue/tournois. |
| Interaction users | 2 | ✅ | Chat + profil + amis. |
| Gestion users standard | 2 | ✅ | Profil, avatar, amis, présence. |
| Permissions avancées | 2 | ✅ | Seulement 2 rôles (admin/user) : « admin, user… » suffit. |
| Jeu web (échecs) | 2 | ✅ | Pendule absente (non exigée). |
| Adversaire IA | 2 | ✅ | Expliquez l'algorithme. |
| Graphismes 3D | 2 | ✅ | Montrer ombres, caméra, performance. |
| ORM Prisma | 1 | ✅ | — |
| Notifications | 1 | ✅ | — |
| Design system | 1 | ✅ | > 10 composants. |
| Recherche avancée | 1 | ✅ | Filtres + tri + pagination. |
| Multilingue | 1 | ✅ | 3 langues, sélecteur, tout traduit. Vérifiez qu'aucun texte n'est resté en dur. |
| OAuth 42 | 1 | ⚠️ | Dépend de la config 42 : à tester la veille. |
| 2FA | 1 | ✅ | — |
| Stats et historique | 1 | ⚠️ | Solide pour le babyfoot ; pas de stats d'échecs. |
| Chat avancé | 1 | ✅ | — |
| Tournois | 1 | ⚠️ | Tournoi de babyfoot, pas d'échecs. |
| Gamification | 1 | ✅ | Badges + XP/niveaux + classement. |
| Health + backups | 1 | ✅ | — |
| RGPD | 1 | ✅ | — |

**Non revendiqués** (ne pas les citer comme validés) : remote players, spectateur, personnalisation de jeu, 2e jeu, multijoueur 3+, upload de fichiers complet, import/export, PWA, RTL, navigateurs supplémentaires, API publique, WCAG, analytics, ELK/Prometheus, microservices, blockchain, IA (RAG/LLM/recommandation…).

---

## 5. Qualité du code, travail d'équipe, fonctionnalité

- **Structure** : un dossier par domaine, découpe controller/service/repository/entity/DTO, commentaires `[Module]` sur chaque fonction → montrer `docs/modules/` et ouvrir un fichier.
- **Décisions techniques** (préparez 3 phrases chacune) : pourquoi NestJS (modules par domaine), Prisma (typage, migrations), RTK Query (cache + invalidation par événements socket), Socket.IO (rooms, reconnexion), chess.js côté serveur (autorité), worker thread pour l'IA, nginx + TLS.
- **Difficultés vécues** : voir la section « Challenges faced » du README (dépendances circulaires `forwardRef`, double comptage `matchesPlayed`…).
- **Stabilité / multi-utilisateurs** : gardez deux navigateurs ouverts pendant toute la démo ; testez à l'avance les parcours d'erreur (mauvais mot de passe, coup illégal, compte banni).
- **Qualité à citer** : typage strict, ESLint, validation partout, secrets hors dépôt, sauvegardes automatiques.

## 6. Décision finale et bonus
- Le décompte final ne retient que les modules **démontrés et fonctionnels** : démontrez-les dans l'ordre de la section 4.2 pour ne rien oublier.
- Le bonus est évalué seulement si le tronc commun est parfait : soignez d'abord les sections 2 et 3 (déploiement, console, HTTPS, validation, secrets).

---

## Écarts connus à corriger avant de passer (README et dépôt)

1. **README, section Modules** : indique « 19 points » sans le jeu d'échecs et affirme que les modules Gaming ne sont pas revendiqués ; il faut le réaligner sur [`docs/modules/README.md`](modules/README.md) (jeu web, IA, 3D, stats, tournois, chat avancé…). Retirer « PWA / navigateurs » des « planned » s'ils ne sont pas faits.
2. **README, équipe** : renvoie vers `docs/team/*.md` et `docs/PLAN.md`, `docs/DESIGN_SYSTEM.md`, `docs/BACKUP.md`, `docs/DOCKER.md`, `docs/PRESENCE.md` — **ces fichiers sont actuellement supprimés dans votre copie de travail** (`git status`) : restaurez-les (`git checkout -- docs`) ou retirez les liens, sinon liens cassés (et les fiches modules y font référence).
3. **README, comptes de démo** : `alice@ft.local`/`bob@ft.local` n'existent plus (voir section 0).
4. **Noms d'auteurs git ≠ logins du README** : expliquez ou alignez (voir 1.4).
5. **Secrets JWT locaux** : régénérer (section 0).
6. **Lint backend** : une erreur préexistante (`Paginated` importé et inutilisé dans `chess.service.ts`) à supprimer pour un dépôt propre.
