# Authentification à deux facteurs (2FA TOTP)

**Type** : Minor (1 pt)  ·  **Sujet** : IV.3 User Management — « Implement a complete 2FA system »  ·  **Tag dans le code** : `[Minor · 2FA]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Minor · 2FA] … */` : cherchez `[Minor · 2FA]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Système 2FA complet.

## Ce qui est implémenté

2FA par **TOTP** (otplib, compatible Google Authenticator/Authy) avec QR code d'activation, vérification à la connexion en deux étapes, **codes de secours** à usage unique et possibilité de les régénérer ou de désactiver la 2FA.

## Logique utilisée

1. **Activation** : `generate2faSecret` (secret + URL `otpauth://`), le front affiche un QR code (`qrcode`) ; `toggle2fa` n'active qu'après un code valide (`assertValidTotp`).
2. **Connexion** : si la 2FA est active, le login ne renvoie pas d'access token mais pose un **cookie de pré-authentification** (token à courte durée, `PreAuthTokenStrategy/Guard`) ; `verify2fa` vérifie le code TOTP puis émet les vrais tokens.
3. **Codes de secours** : `issueRecoveryCodes` génère des codes, stockés **hachés** (`hashRecoveryCode`), à usage unique (`consumeRecoveryCode`/`useRecoveryCode`) ; `regenerateRecoveryCodes` exige un code TOTP ou le mot de passe. Après une connexion par code de secours, l'utilisateur est renvoyé vers les réglages 2FA pour reconfigurer.
4. **Front** : `TwoFactorSettings` (activation/désactivation), `Login` (formulaires TOTP et code de secours), `RecoveryCodesCard` (copie/téléchargement/régénération), `CodeInput` (saisie à 6 chiffres).

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/auth/auth.controller.ts`](../../backend/src/auth/auth.controller.ts)**

- `verify2fa` ([l.226](../../backend/src/auth/auth.controller.ts#L226)) — POST /auth/2fa/verify : valide le code 2FA de la pré-authentification et ouvre la session (tokens et cookie de refresh).
- `pending2fa` ([l.247](../../backend/src/auth/auth.controller.ts#L247)) — GET /auth/2fa/pending : confirme qu'une pré-authentification 2FA valide est en cours.
- `setup2fa` ([l.254](../../backend/src/auth/auth.controller.ts#L254)) — POST /auth/2fa/setup : génère un secret 2FA en attente et l'URL otpauth pour le QR code.
- `toggle2fa` ([l.264](../../backend/src/auth/auth.controller.ts#L264)) — POST /auth/2fa/toggle : active ou désactive la 2FA après vérification d'un code (ou d'un code de secours pour désactiver) ; retourne le nouvel état e…
- `useRecoveryCode` ([l.274](../../backend/src/auth/auth.controller.ts#L274)) — POST /auth/2fa/use-recovery-code : comme 2fa/verify mais avec un code de secours à usage unique (appli d'authentification perdue).
- `recoveryCodesStatus` ([l.300](../../backend/src/auth/auth.controller.ts#L300)) — GET /auth/2fa/recovery-codes : nombre de codes de secours encore utilisables (les codes eux-mêmes ne sont jamais relisibles).
- `regenerateRecoveryCodes` ([l.309](../../backend/src/auth/auth.controller.ts#L309)) — POST /auth/2fa/recovery-codes/regenerate : après re-confirmation (code TOTP ou mot de passe), remplace les codes de secours et retourne le nouveau lo…
- `setPreAuthCookie` ([l.366](../../backend/src/auth/auth.controller.ts#L366)) — Pose le cookie httpOnly du token de pré-authentification 2FA (durée depuis la config).

**[`backend/src/auth/auth.service.ts`](../../backend/src/auth/auth.service.ts)**

- `createPreAuthToken` ([l.60](../../backend/src/auth/auth.service.ts#L60)) — Signe un JWT de courte durée prouvant que le mot de passe est validé, en attente du code 2FA.
- `verify2fa` ([l.206](../../backend/src/auth/auth.service.ts#L206)) — Vérifie le code TOTP de l'utilisateur avec son secret 2FA actif.
- `assertValidTotp` ([l.211](../../backend/src/auth/auth.service.ts#L211)) — Lève une UnauthorizedException si le secret est absent ou si le code TOTP est invalide (tolérance d'un pas de temps).
- `generate2faSecret` ([l.237](../../backend/src/auth/auth.service.ts#L237)) — Génère un secret TOTP et l'URL otpauth, le stocke comme secret en attente ; refuse si la 2FA est déjà active.
- `toggle2fa` ([l.261](../../backend/src/auth/auth.service.ts#L261)) — Désactive la 2FA (code TOTP ou code de secours requis) ou l'active en confirmant le secret en attente avec un code valide.
- `issueRecoveryCodes` ([l.307](../../backend/src/auth/auth.service.ts#L307)) — Génère un nouveau lot de codes de secours (format XXXXX-XXXXX), remplace l'ancien en base (hashs seulement) et retourne les codes en clair.
- `hashRecoveryCode` ([l.324](../../backend/src/auth/auth.service.ts#L324)) — Hash d'un code de secours après normalisation (casse, tirets et espaces ignorés).
- `consumeRecoveryCode` ([l.329](../../backend/src/auth/auth.service.ts#L329)) — Consomme un code de secours (usage unique) ; lève une UnauthorizedException s'il est invalide ou déjà utilisé.
- `useRecoveryCode` ([l.346](../../backend/src/auth/auth.service.ts#L346)) — Connexion avec un code de secours à la place du code TOTP : le consomme, prévient l'utilisateur par email et retourne le nombre de codes restants.
- `countRecoveryCodes` ([l.359](../../backend/src/auth/auth.service.ts#L359)) — Nombre de codes de secours encore utilisables.
- `regenerateRecoveryCodes` ([l.364](../../backend/src/auth/auth.service.ts#L364)) — Régénère les codes de secours (les anciens deviennent invalides) après re-confirmation par code TOTP ou mot de passe ; retourne les nouveaux codes.

**[`backend/src/auth/dtos/recovery-code.dto.ts`](../../backend/src/auth/dtos/recovery-code.dto.ts)**

- `RecoveryCodeDto` ([l.4](../../backend/src/auth/dtos/recovery-code.dto.ts#L4)) — Corps validé d'un code de secours 2FA.

**[`backend/src/auth/dtos/two-factor-code.dto.ts`](../../backend/src/auth/dtos/two-factor-code.dto.ts)**

- `TwoFactorCodeDto` ([l.4](../../backend/src/auth/dtos/two-factor-code.dto.ts#L4)) — Corps validé d'un code TOTP à 6 chiffres.

**[`backend/src/auth/guards/pre-auth-token.guard.ts`](../../backend/src/auth/guards/pre-auth-token.guard.ts)**

- `PreAuthTokenGuard` ([l.11](../../backend/src/auth/guards/pre-auth-token.guard.ts#L11)) — Guard du token de pré-authentification (cookie posé entre le login et la saisie du code 2FA).
- `canActivate` ([l.14](../../backend/src/auth/guards/pre-auth-token.guard.ts#L14)) — Délègue la vérification du token à la stratégie Passport.
- `handleRequest` ([l.21](../../backend/src/auth/guards/pre-auth-token.guard.ts#L21)) — Retourne l'utilisateur validé ou lève une UnauthorizedException si le token de pré-authentification est invalide.

**[`backend/src/auth/strategies/pre-auth-token.strategy.ts`](../../backend/src/auth/strategies/pre-auth-token.strategy.ts)**

- `PreAuthTokenStrategy` ([l.13](../../backend/src/auth/strategies/pre-auth-token.strategy.ts#L13)) — Stratégie passport du token de pré-authentification utilisé pendant l'étape 2FA.
- `constructor` ([l.21](../../backend/src/auth/strategies/pre-auth-token.strategy.ts#L21)) — Injecte les dépendances : AuthService.
- `validate` ([l.44](../../backend/src/auth/strategies/pre-auth-token.strategy.ts#L44)) — Retrouve l'utilisateur du payload JWT de pré-authentification ; il devient req.user.

**[`backend/src/users/repositories/users.repository.ts`](../../backend/src/users/repositories/users.repository.ts)**

- `replaceRecoveryCodes` ([l.218](../../backend/src/users/repositories/users.repository.ts#L218)) — Remplace tous les codes de secours 2FA de l'utilisateur par un nouveau lot (hashs).
- `deleteRecoveryCodes` ([l.231](../../backend/src/users/repositories/users.repository.ts#L231)) — Supprime tous les codes de secours 2FA de l'utilisateur.
- `consumeRecoveryCode` ([l.236](../../backend/src/users/repositories/users.repository.ts#L236)) — Marque un code de secours comme utilisé ; retourne true s'il existait et n'avait pas déjà servi (usage unique, même en concurrence).
- `countUnusedRecoveryCodes` ([l.248](../../backend/src/users/repositories/users.repository.ts#L248)) — Nombre de codes de secours encore utilisables.

**[`backend/src/users/services/users.services.ts`](../../backend/src/users/services/users.services.ts)**

- `replaceRecoveryCodes` ([l.405](../../backend/src/users/services/users.services.ts#L405)) — Remplace les codes de secours 2FA de l'utilisateur par un nouveau lot (hashs).
- `deleteRecoveryCodes` ([l.410](../../backend/src/users/services/users.services.ts#L410)) — Supprime les codes de secours 2FA de l'utilisateur.
- `consumeRecoveryCode` ([l.415](../../backend/src/users/services/users.services.ts#L415)) — Consomme un code de secours (usage unique) ; retourne true s'il était valide.
- `countUnusedRecoveryCodes` ([l.420](../../backend/src/users/services/users.services.ts#L420)) — Nombre de codes de secours encore utilisables.

### Frontend (React)

**[`frontend/src/features/auth/RecoveryCodesCard.tsx`](../../frontend/src/features/auth/RecoveryCodesCard.tsx)**

- `RecoveryCodesCard` ([l.29](../../frontend/src/features/auth/RecoveryCodesCard.tsx#L29)) — Affiche les codes de secours 2FA une seule fois (avec consigne de les noter), puis permet de les régénérer après re-confirmation.
- `resetForm` ([l.41](../../frontend/src/features/auth/RecoveryCodesCard.tsx#L41)) — Réinitialise le formulaire de régénération (mode, code, mot de passe, erreur).
- `handleRegenerate` ([l.50](../../frontend/src/features/auth/RecoveryCodesCard.tsx#L50)) — Régénère les codes de secours après confirmation par un code TOTP ou le mot de passe, puis remonte les nouveaux codes.
- `handleCopy` ([l.64](../../frontend/src/features/auth/RecoveryCodesCard.tsx#L64)) — Copie les codes de secours dans le presse-papiers.
- `handleDownload` ([l.75](../../frontend/src/features/auth/RecoveryCodesCard.tsx#L75)) — Télécharge les codes de secours dans un fichier texte.

**[`frontend/src/features/auth/authApi.ts`](../../frontend/src/features/auth/authApi.ts)**

- `onQueryStarted` ([l.218](../../frontend/src/features/auth/authApi.ts#L218)) — Après vérification du code 2FA : stocke l'access token définitif.
- `onQueryStarted` ([l.255](../../frontend/src/features/auth/authApi.ts#L255)) — Après l'usage d'un code de secours : stocke l'access token définitif.

**[`frontend/src/features/auth/two-factor.schema.ts`](../../frontend/src/features/auth/two-factor.schema.ts)**

- `createRecoveryCodeSchema` ([l.4](../../frontend/src/features/auth/two-factor.schema.ts#L4)) — Schéma zod d'un code de secours (10 caractères alphanumériques, tiret facultatif).
- `createTwoFactorSchema` ([l.14](../../frontend/src/features/auth/two-factor.schema.ts#L14)) — Schéma zod d'un code TOTP à 6 chiffres.

**[`frontend/src/pages/Login.tsx`](../../frontend/src/pages/Login.tsx)**

- `RecoveryCodeForm` ([l.230](../../frontend/src/pages/Login.tsx#L230)) — Formulaire de connexion avec un code de secours 2FA (utilisable une seule fois).
- `TwoFactorForm` ([l.349](../../frontend/src/pages/Login.tsx#L349)) — Formulaire de saisie du code TOTP à 6 chiffres après un login qui exige la 2FA.

**[`frontend/src/pages/TwoFactorSettings.tsx`](../../frontend/src/pages/TwoFactorSettings.tsx)**

- `TwoFactorSettings` ([l.35](../../frontend/src/pages/TwoFactorSettings.tsx#L35)) — Page de gestion de la 2FA : activation (QR code + code de confirmation), désactivation et codes de secours.
- `clearSetupPreview` ([l.55](../../frontend/src/pages/TwoFactorSettings.tsx#L55)) — Efface le QR code et le secret affichés pendant l'activation.
- `handleSetup` ([l.89](../../frontend/src/pages/TwoFactorSettings.tsx#L89)) — Demande au backend un nouveau secret TOTP et affiche son QR code pour l'application d'authentification.
- `handleDisable` ([l.109](../../frontend/src/pages/TwoFactorSettings.tsx#L109)) — Désactivation avec un code de secours (appli perdue) ; sinon passe par le formulaire du code de l'appli.

### Base de données

**[`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)**

- `TwoFactorRecoveryCode` ([l.224](../../backend/prisma/schema.prisma#L224)) — Codes de secours 2FA à usage unique (hachés).

### Autres fichiers liés

- `backend/src/auth/dtos/two-factor-code.dto.ts, recovery-code.dto.ts` — Validation des codes TOTP et de secours.

## Comment le démontrer

- Activer la 2FA avec un authentificateur, se déconnecter, se reconnecter avec le code ; tester un code de secours.
