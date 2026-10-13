# Frameworks front + back (React + NestJS)

**Type** : Major (2 pts)  ·  **Sujet** : IV.1 Web — « Use a framework for both the frontend and backend »  ·  **Tag dans le code** : `[Major · Frameworks React + NestJS]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Major · Frameworks React + NestJS] … */` : cherchez `[Major · Frameworks React + NestJS]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Un framework frontend (React, Vue, Angular, Svelte…).
- Un framework backend (Express, NestJS, Django…).

## Ce qui est implémenté

Le frontend est une SPA **React 19 + TypeScript** (Vite 8, React Router 8, Redux Toolkit/RTK Query, Tailwind 4, TanStack Form + Zod). Le backend est une API **NestJS 11** (modules, controllers, services, repositories, guards, gateways WebSocket, validation `class-validator`). Les deux sont conteneurisés (Docker, `make dev` / `make prod`).

## Logique utilisée

1. **Backend** : `main.ts` démarre Nest (filtre d'exceptions global, `ValidationPipe` strict qui rejette les champs inconnus, `cookie-parser`, `ClassSerializerInterceptor`, CORS limité à `FRONTEND_URL`, fichiers statiques `/uploads`). `AppModule` assemble un module par domaine (auth, users, chat, chess, matches, tournaments…).
2. Chaque domaine suit la même découpe : **controller** (routes HTTP) → **service** (logique métier) → **repository** (requêtes Prisma) → **entity** (forme exposée à l'API) + **DTO** (validation d'entrée).
3. Le filtre `AllExceptionsFilter` uniformise toutes les erreurs en `{ code, statusCode, message, timestamp, path }` : le front traduit le `code`.
4. **Frontend** : `main.tsx` empile les providers (store Redux, thème, i18n, router, bootstrap d'auth) ; `App.tsx` déclare les routes (pages chargées à la demande via `lazyPage`) ; `ProtectedLayout` protège les pages privées et monte les « bootstraps » temps réel.
5. Les appels API passent par **RTK Query** (`store/api.ts`) : un `baseQuery` ajoute le Bearer token, et sur 401 tente un refresh unique puis rejoue la requête (sinon déconnexion).

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/common/filters/all-exceptions.filter.ts`](../../backend/src/common/filters/all-exceptions.filter.ts)**

- `AllExceptionsFilter` ([l.10](../../backend/src/common/filters/all-exceptions.filter.ts#L10)) — Filtre global : toutes les erreurs deviennent une réponse JSON uniforme avec code stable.
- `catch` ([l.16](../../backend/src/common/filters/all-exceptions.filter.ts#L16)) — Intercepte toute exception et répond avec un JSON uniforme (statusCode, message, timestamp, path) ; les erreurs non HTTP deviennent une 500 générique.

**[`backend/src/main.ts`](../../backend/src/main.ts)**

- `bootstrap` ([l.13](../../backend/src/main.ts#L13)) — Démarre l'application Nest : logger, filtre d'exceptions global, validation stricte des DTO, cookies, sérialisation des entités, fichiers statiques /…

### Frontend (React)

**[`frontend/src/App.tsx`](../../frontend/src/App.tsx)**

- `App` ([l.41](../../frontend/src/App.tsx#L41)) — Composant racine : déclare toutes les routes React Router (pages publiques, puis pages protégées derrière ProtectedLayout/DashboardLayout, puis pages…

**[`frontend/src/app/store-provider.tsx`](../../frontend/src/app/store-provider.tsx)**

- `StoreProvider` ([l.9](../../frontend/src/app/store-provider.tsx#L9)) — Fournit le store Redux et la réhydratation du stockage local (PersistGate) à toute l'application.

**[`frontend/src/lib/get-error-message.ts`](../../frontend/src/lib/get-error-message.ts)**

- `translateErrorCode` ([l.3](../../frontend/src/lib/get-error-message.ts#L3)) — Traduit un code d'erreur du backend (`errors.<CODE>`) dans la langue active ; null si le code est absent ou sans traduction.
- `getErrorMessage` ([l.15](../../frontend/src/lib/get-error-message.ts#L15)) — 

**[`frontend/src/lib/lazy-page.ts`](../../frontend/src/lib/lazy-page.ts)**

- `lazyPage` ([l.3](../../frontend/src/lib/lazy-page.ts#L3)) — Charge une page à la demande (chunk séparé) à partir de son export nommé.

**[`frontend/src/lib/logger.ts`](../../frontend/src/lib/logger.ts)**

- `logger` ([l.1](../../frontend/src/lib/logger.ts#L1)) — Journal de développement : écrit dans la console uniquement en mode dev (aucun log en production).

**[`frontend/src/lib/navigation.ts`](../../frontend/src/lib/navigation.ts)**

- `setNavigate` ([l.5](../../frontend/src/lib/navigation.ts#L5)) — Rempli par <NavigationBridge/>, monté une fois sous <BrowserRouter>.
- `navigate` ([l.10](../../frontend/src/lib/navigation.ts#L10)) — Navigation programmatique utilisable en dehors de l'arbre React (sockets, etc.).

**[`frontend/src/store/api.ts`](../../frontend/src/store/api.ts)**

- `baseQuery` ([l.14](../../frontend/src/store/api.ts#L14)) — Client HTTP de base : URL de l'API, cookies inclus (refresh httpOnly) et en-tête Authorization Bearer ajouté depuis l'access token du store.
- `baseQueryWithReauth` ([l.27](../../frontend/src/store/api.ts#L27)) — Enveloppe du client HTTP : sur ban (403 BAN) coupe la session ; sur 401 d'une vraie session tente un seul refresh du token puis rejoue la requête, si…
- `api` ([l.78](../../frontend/src/store/api.ts#L78)) — Instance RTK Query unique de l'application : cache et tags d'invalidation ; chaque domaine y injecte ses endpoints (injectEndpoints).

**[`frontend/src/store/hooks.ts`](../../frontend/src/store/hooks.ts)**

- `useAppDispatch` ([l.4](../../frontend/src/store/hooks.ts#L4)) — `useDispatch` typé avec le store de l'application.
- `useAppSelector` ([l.6](../../frontend/src/store/hooks.ts#L6)) — `useSelector` typé avec l'état racine de l'application.

**[`frontend/src/store/index.ts`](../../frontend/src/store/index.ts)**

- `store` ([l.33](../../frontend/src/store/index.ts#L33)) — Store Redux : réducteurs auth / réglages (persistés) / cache RTK Query, et middleware RTK Query.

### Autres fichiers liés

- `frontend/vite.config.ts` — Config Vite : alias `@`, React Compiler, Tailwind, suppression des `console.*` au build de production.
- `frontend/package.json` — Dépendances du front (React 19, Vite 8, Redux Toolkit, React Router, Tailwind…).
- `backend/package.json` — Dépendances de l'API (NestJS 11, Prisma 7, Socket.IO, chess.js, otplib…).
- `docker-compose.yml / docker-compose.dev.yml / Makefile` — Orchestration prod et dev (`make dev`, `make prod`).
- `frontend/src/main.tsx` — Point d'entrée React : providers (store, thème, i18n, router, auth).

## Comment le démontrer

- Montrer `make dev` : front sur :5173, API sur :5000.
- Montrer la structure `backend/src/<domaine>/{controller,services,repositories,entities,dtos}`.
