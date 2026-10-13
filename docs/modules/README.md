# Modules validés — ft_transcendence

Un document par module du sujet que le projet implémente réellement. Chaque fiche donne : ce que demande le sujet, ce qui est fait, la logique, **tous les fichiers et fonctions concernés** (liens vers le code) et comment le démontrer.

Dans le code, chaque fonction ou classe d'un module porte un commentaire `/** [Major · …] … */` ou `/** [Minor · …] … */` avec le nom du module ; le « socle produit babyfoot » désigne les parties qui ne relèvent d'aucun module du sujet (tables, file d'attente).

**Total : 29 points** (objectif 100 % = 14 points, 125 % = 19 points) : l'excédent sert de filet si un module n'était pas validé.

| # | Module | Type | Pts | Fiche |
|---|---|---|---|---|
| 1 | Frameworks front + back (React + NestJS) | Major | 2 | [01-frameworks-react-nestjs.md](01-frameworks-react-nestjs.md) |
| 2 | Temps réel (WebSockets) | Major | 2 | [02-temps-reel-websockets.md](02-temps-reel-websockets.md) |
| 3 | Interaction entre utilisateurs (chat, profil, amis) | Major | 2 | [03-interaction-entre-utilisateurs.md](03-interaction-entre-utilisateurs.md) |
| 4 | Gestion standard des utilisateurs et authentification | Major | 2 | [04-gestion-utilisateurs-standard.md](04-gestion-utilisateurs-standard.md) |
| 5 | Système de permissions avancé (rôles, CRUD admin, bannissements) | Major | 2 | [05-permissions-avancees.md](05-permissions-avancees.md) |
| 6 | Jeu web complet : les échecs | Major | 2 | [06-jeu-web-echecs.md](06-jeu-web-echecs.md) |
| 7 | Adversaire IA pour les échecs | Major | 2 | [07-adversaire-ia.md](07-adversaire-ia.md) |
| 8 | Graphismes 3D avancés (Three.js) | Major | 2 | [08-graphismes-3d.md](08-graphismes-3d.md) |
| 9 | ORM Prisma | Minor | 1 | [09-orm-prisma.md](09-orm-prisma.md) |
| 10 | Système de notifications | Minor | 1 | [10-systeme-de-notifications.md](10-systeme-de-notifications.md) |
| 11 | Design system personnalisé | Minor | 1 | [11-design-system.md](11-design-system.md) |
| 12 | Recherche avancée (filtres, tri, pagination) | Minor | 1 | [12-recherche-avancee.md](12-recherche-avancee.md) |
| 13 | Support de plusieurs langues | Minor | 1 | [13-multilingue.md](13-multilingue.md) |
| 14 | Authentification distante OAuth 2.0 (42) | Minor | 1 | [14-oauth-42.md](14-oauth-42.md) |
| 15 | Authentification à deux facteurs (2FA TOTP) | Minor | 1 | [15-authentification-2fa.md](15-authentification-2fa.md) |
| 16 | Statistiques de jeu et historique des matchs | Minor | 1 | [16-statistiques-et-historique.md](16-statistiques-et-historique.md) |
| 17 | Fonctionnalités avancées du chat | Minor | 1 | [17-chat-avance.md](17-chat-avance.md) |
| 18 | Système de tournois | Minor | 1 | [18-systeme-de-tournois.md](18-systeme-de-tournois.md) |
| 19 | Système de gamification | Minor | 1 | [19-gamification.md](19-gamification.md) |
| 20 | Health check, page de statut, sauvegardes et reprise | Minor | 1 | [20-health-check-et-sauvegardes.md](20-health-check-et-sauvegardes.md) |
| 21 | Conformité RGPD | Minor | 1 | [21-conformite-rgpd.md](21-conformite-rgpd.md) |

## Modules du sujet volontairement non revendiqués

- **Remote players** : les parties se jouent bien à distance, mais il manque la reconnexion de partie et la gestion de latence demandées.
- **Spectator mode, game customization, 2e jeu, multijoueur 3+** : non implémentés.
- **File upload and management** : seul l'avatar est géré (un format, pas de progression ni de suppression) — insuffisant pour le module.
- **Data export and import** : l'export existe (RGPD) mais pas l'import.
- **PWA, RTL, navigateurs supplémentaires, API publique, WCAG, analytics, ELK/Prometheus, microservices, blockchain, IA (RAG/LLM/recommandation…)** : non implémentés.
