# Plan — ft_transcendence (Babyfoot 42 Paris)

Document de travail équipe. Le `README.md` racine (anglais, éval 42) viendra plus tard.

Objectif note : **125%** = **14 pts modules + 5 pts bonus**.

## Produit

Pas un Pong. Un site pour les **2 babyfoot de 42 Paris** :

- Login Intra 42 (email / mot de passe reste obligatoire pour le sujet).
- Voir si un baby est **libre ou occupé**.
- Si occupé : **file d’attente**.
- Match **2v2** : une équipe entre le score, **au moins 1 joueur adverse valide**.
- **Classement Elo** : battre un mieux classé rapporte plus que l’inverse.

Le babyfoot est physique. On **ne claim pas** les modules Gaming (jeu web, remote, tournoi, spectator, stats de match du sujet). L’Elo est une feature produit, pas le module « Game statistics ».

## Répartition

Règle : **toi = le autour (socle web)**. **Les mates = le babyfoot**, chacun une feature complète (Prisma → route Nest → page React). Review des PR, pas de réécriture.

À l’éval, tout le monde explique le projet. Rôles (PO / PM / Tech Lead) à coller dans le README.

### Socle (autour) — déjà ~8 pts

Auth email, OAuth 42, JWT, 2FA, profil, avatar, amis, i18n EN/FR/ES, thème, Docker, Prisma.

Reste à finir **avant** que les mates branchent le métier :

1. Presence online (heartbeat WebSocket) — requis pour le major Users.
2. HTTPS + cookies `secure`.
3. Privacy Policy + Terms of Service + liens footer (mandatory, sinon rejet).
4. Polish 2FA (secret pending jusqu’au code TOTP, wipe à la désactivation) + persister thème / langue.
5. Gateway WebSocket **vide** + auth socket, pour que les mates s’y branchent.
6. Squelette README racine (anglais).

### Produit — mates (une personne = une slice)

Ordre :

1. **Tables** — 2 baby, libre / occupé, page live.
2. **Queue** — s’inscrire, ordre FIFO, notif « à toi ». Timeout si tu ne prends pas la table.
3. **Match** — saisie du score + validation par 1 adversaire.
4. **Elo** — classement. La formule peut être fournie commentée ; eux branchent persist + UI.

Pair ~30 min au début de chaque feature, ensuite ils pushent.

## Pack modules 19 pts (125%)

Major = 2, minor = 1. Le bonus ne compte que si les **14** sont démoables.

### 14 pts (100%)

| Module                                         | Type  | Pts | Qui   | État                                   |
| ---------------------------------------------- | ----- | --- | ----- | -------------------------------------- |
| Frameworks FE + BE (React + NestJS)            | Major | 2   | Socle | Fait                                   |
| ORM Prisma                                     | Minor | 1   | Socle | Fait                                   |
| User management (profil, avatar, amis, online) | Major | 2   | Socle | Presence à finir                       |
| OAuth 2.0 Intra 42                             | Minor | 1   | Socle | Fait                                   |
| 2FA TOTP                                       | Minor | 1   | Socle | Fait (polish)                          |
| i18n 3 langues                                 | Minor | 1   | Socle | Fait                                   |
| WebSockets temps réel                          | Major | 2   | Mates | Tables + queue live                    |
| Interaction users (chat + profil + amis)       | Major | 2   | Mates | Chat à ajouter                         |
| Notifications CUD                              | Minor | 1   | Mates | Tour / score à valider / table libre   |
| Gamification                                   | Minor | 1   | Mates | Leaderboard + badges + XP (3 features) |

### +5 bonus (125%)

| Module                                     | Type  | Pts | Note                                        |
| ------------------------------------------ | ----- | --- | ------------------------------------------- |
| GDPR                                       | Minor | 1   | Export / suppression compte / confirmation  |
| PWA                                        | Minor | 1   | Install tel, voir si un baby est libre      |
| Autres navigateurs (Firefox + Safari/Edge) | Minor | 1   | Tester et documenter                        |
| Healthcheck + backups                      | Minor | 1   | Status page + dump Postgres                 |
| Recherche avancée                          | Minor | 1   | Joueurs / matchs : filtres, tri, pagination |

Filet si un module tombe : API publique (2), permissions admin (2), dashboard analytics (2), file upload complet (1), chat avancé (1). Viser 16–19 implémentés pour en valider 19.

## Abordable plus tard (pas dans le pack)

API publique, permissions CRUD / rôles, organisations (clans), analytics user, WCAG AA, RTL, dashboard analytics, export/import, WAF+Vault, ELK, Grafana, microservices, chat avancé, file upload complet.

## À ne pas claim

Jeu web, remote players, tournoi, spectator, customisation de jeu, IA opponent, 2e jeu, 3D, stats de match (module sujet), scores tournoi blockchain, backend ICP.

## Règles métier (v1)

- **Occupation** : honor system. Un joueur déclare occupé / libre. Pas d’IoT.
- **Queue** : solo ou duo. Match à 4 (2v2). Timeout 2–3 min si tu ne confirmes pas → tu sautes.
- **Score** : n’importe quel joueur du match soumet. Il faut 1 joueur de l’autre équipe. Sans validation sous X minutes : litige, pas d’Elo.
- **Elo** : rating individuel, moyenne d’équipe pour l’expected score. K plus haut pour les nouveaux. Calcul **côté serveur**.
- **Tables seed** : Baby A / Baby B (42 Paris).

Hors scope v1 : capteurs, réservation à l’avance, 1v1, admin CRUD complet.

## Modèle (indicatif)

- `Table` — id, name, status FREE/BUSY, currentMatchId, occupiedAt
- `QueueEntry` — tableId, userId, position, joinedAt, teammateId optionnel
- `Match` — 4 playerIds, scoreA/B, submittedBy, validatedBy, status, ratings avant/après
- `User.rating` — Elo

Un seul gateway WebSocket pour presence, tables, queue, notifs.
