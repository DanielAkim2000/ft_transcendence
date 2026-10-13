# Authentification distante OAuth 2.0 (42)

**Type** : Minor (1 pt)  ·  **Sujet** : IV.3 User Management — « Implement remote authentication with OAuth 2.0 (Google, GitHub, 42…) »  ·  **Tag dans le code** : `[Minor · OAuth 42]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Minor · OAuth 42] … */` : cherchez `[Minor · OAuth 42]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Connexion avec un fournisseur OAuth 2.0.

## Ce qui est implémenté

Connexion « Se connecter avec 42 » via **passport-42** : le compte est créé ou retrouvé à partir du profil intra (`login42`), puis la session est posée comme pour une connexion classique (cookie de refresh).

## Logique utilisée

1. `GET /auth/42/login` redirige vers 42 ; `FortyTwoStrategy.validate` reçoit le profil ; `validateUserFrom42Profile` crée l'utilisateur (`createUserFrom42Profile`) ou le retrouve.
2. `GET /auth/42/callback` pose le cookie de refresh (ou le cookie de **pré-authentification** si la 2FA est active) puis redirige vers `/auth/callback` du front.
3. `AuthCallback` (front) laisse `AuthBootstrap` restaurer la session via le cookie ; si une pré-authentification 2FA est en attente, elle bascule vers le formulaire de code.
4. L'URL de retour doit être **exactement** enregistrée chez 42 : en prod `https://<hôte>/api/auth/42/callback`, en dev `http://localhost:5000/auth/42/callback`.

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/auth/auth.controller.ts`](../../backend/src/auth/auth.controller.ts)**

- `callback` ([l.98](../../backend/src/auth/auth.controller.ts#L98)) — GET /auth/42/callback : retour de l'OAuth 42 ; pose le cookie de refresh (ou de pré-authentification si 2FA) puis redirige vers le frontend.

**[`backend/src/auth/auth.service.ts`](../../backend/src/auth/auth.service.ts)**

- `validateUserFrom42Profile` ([l.152](../../backend/src/auth/auth.service.ts#L152)) — Retourne l'utilisateur lié au login 42 du profil, en le créant à la première connexion.

**[`backend/src/auth/dtos/profile42.dto.ts`](../../backend/src/auth/dtos/profile42.dto.ts)**

- `Profile42ImageDto` ([l.14](../../backend/src/auth/dtos/profile42.dto.ts#L14)) — Variantes d'image du profil renvoyé par l'API 42.
- `Profile42JsonDto` ([l.26](../../backend/src/auth/dtos/profile42.dto.ts#L26)) — Données JSON du profil renvoyé par l'API 42.
- `Profile42Dto` ([l.71](../../backend/src/auth/dtos/profile42.dto.ts#L71)) — Profil complet renvoyé par l'API 42 après l'OAuth.

**[`backend/src/auth/strategies/forty-two.strategy.ts`](../../backend/src/auth/strategies/forty-two.strategy.ts)**

- `StrategyOptions` ([l.8](../../backend/src/auth/strategies/forty-two.strategy.ts#L8)) — Options de la stratégie passport-42 (client, secret, URL de callback).
- `FortyTwoStrategy` ([l.16](../../backend/src/auth/strategies/forty-two.strategy.ts#L16)) — Stratégie passport-42 : OAuth 2.0 avec l'intra 42, récupère le profil et crée ou retrouve le compte.
- `constructor` ([l.22](../../backend/src/auth/strategies/forty-two.strategy.ts#L22)) — Injecte les dépendances : AuthService.
- `validate` ([l.45](../../backend/src/auth/strategies/forty-two.strategy.ts#L45)) — Reçoit le profil OAuth 42 et retourne l'utilisateur correspondant (créé si nouveau).

### Frontend (React)

**[`frontend/src/pages/AuthCallback.tsx`](../../frontend/src/pages/AuthCallback.tsx)**

- `AuthCallback` ([l.9](../../frontend/src/pages/AuthCallback.tsx#L9)) — Page de retour de l'OAuth 42 : si AuthBootstrap a déjà récupéré la session (cookie de refresh), redirige vers l'accueil ; sinon vérifie si une pré-au…

**[`frontend/src/pages/Login.tsx`](../../frontend/src/pages/Login.tsx)**

- `handleLoginWith42` ([l.79](../../frontend/src/pages/Login.tsx#L79)) — Lance l'OAuth 42 : pose le témoin de session puis redirige le navigateur vers /auth/42/login du backend.

### Autres fichiers liés

- `backend/src/auth/dtos/profile42.dto.ts` — Forme du profil renvoyé par l'API 42.
- `backend/src/types/passport-42.d.ts` — Typage de passport-42.

## Comment le démontrer

- Se connecter avec 42 ; refaire l'opération sur un compte avec 2FA.

## Points à connaître / limites

- Dépend d'une application 42 correctement configurée (CLIENT_ID, secret, URI de retour).
