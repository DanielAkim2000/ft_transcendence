# Support de plusieurs langues

**Type** : Minor (1 pt)  ·  **Sujet** : IV.2 Accessibility and Internationalization — « Support for multiple languages (at least 3) »  ·  **Tag dans le code** : `[Minor · Multilingue]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Minor · Multilingue] … */` : cherchez `[Minor · Multilingue]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Système d'i18n.
- Au moins 3 langues complètes.
- Sélecteur de langue dans l'UI.
- Tout texte traduisible.

## Ce qui est implémenté

**i18next / react-i18next** avec trois langues complètes (anglais, français, espagnol). La langue est choisie dans l'UI (écrans d'authentification et Réglages), appliquée instantanément et **persistée par utilisateur** en base ; les erreurs de l'API sont traduites grâce à des codes stables.

## Logique utilisée

1. `i18n/index.ts` charge `locales/{en,fr,es}.json` ; `I18nSync` applique la langue du store ; `settingsSlice.setLanguage` + `persistSettings` (Réglages) enregistrent la préférence (`PATCH /users/me/settings`) avec mise à jour optimiste du cache `/auth/me`.
2. **Erreurs** : le backend renvoie un `code` (ex. `ILLEGAL_MOVE`, `INSUFFICIENT_RIGHTS`) ; `translateErrorCode` / `getErrorMessage` le traduisent côté front. Les emails (reset, RGPD, ban) sont envoyés dans la langue de l'utilisateur (`mailLanguage`).
3. Les schémas de validation Zod (`createLoginSchema`…) reçoivent `t` pour traduire leurs messages.

## Fichiers concernés et rôle de chaque fonction

### Frontend (React)

**[`frontend/src/features/settings/SettingsBootstrap.tsx`](../../frontend/src/features/settings/SettingsBootstrap.tsx)**

- `SettingsBootstrap` ([l.7](../../frontend/src/features/settings/SettingsBootstrap.tsx#L7)) — 

**[`frontend/src/features/settings/settingsSlice.ts`](../../frontend/src/features/settings/settingsSlice.ts)**

- `setLanguage` ([l.46](../../frontend/src/features/settings/settingsSlice.ts#L46)) — Change la langue de l'interface (en, fr, es).

**[`frontend/src/features/users/usersApi.ts`](../../frontend/src/features/users/usersApi.ts)**

- `onQueryStarted` ([l.125](../../frontend/src/features/users/usersApi.ts#L125)) — Mise à jour optimiste du cache /auth/me avec le thème/la langue choisis (annulée si la requête échoue) pour éviter qu'une réhydratation avec d'ancien…

**[`frontend/src/i18n/I18nSync.tsx`](../../frontend/src/i18n/I18nSync.tsx)**

- `I18nSync` ([l.9](../../frontend/src/i18n/I18nSync.tsx#L9)) — Applique à i18next la langue choisie dans le store (changement instantané de toutes les traductions).

**[`frontend/src/layouts/AuthShell.tsx`](../../frontend/src/layouts/AuthShell.tsx)**

- `AuthShell` ([l.8](../../frontend/src/layouts/AuthShell.tsx#L8)) — Cadre des pages d'authentification (login, inscription…) : fond, logo, sélecteur de langue EN/FR/ES et liens légaux.

**[`frontend/src/pages/Settings.tsx`](../../frontend/src/pages/Settings.tsx)**

- `persistSettings` ([l.95](../../frontend/src/pages/Settings.tsx#L95)) — Applique tout de suite un réglage (thème, langue, accent, arrondi) dans le store puis l'enregistre en base pour l'utilisateur.

### Base de données

**[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)**

- `LanguagePreference` ([l.135](../../backend/prisma/schema.prisma#L135)) — Langues disponibles (en, fr, es), mémorisées par utilisateur.

### Autres fichiers liés

- `frontend/src/i18n/index.ts` — Initialisation i18next.
- `frontend/src/i18n/locales/en.json, fr.json, es.json` — Les trois traductions complètes de l'interface et des messages d'erreur.

## Comment le démontrer

- Basculer EN/FR/ES sur la page de login puis dans Réglages ; recharger : la langue est conservée.
