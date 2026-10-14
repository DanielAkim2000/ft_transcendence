# Conformité RGPD

**Type** : Minor (1 pt)  ·  **Sujet** : IV.8 Data and Analytics — « GDPR compliance features »  ·  **Tag dans le code** : `[Minor · RGPD]`

> Dans le code, chaque fonction/classe de ce module est précédée d'un commentaire `/** [Minor · RGPD] … */` : cherchez `[Minor · RGPD]` pour retrouver toutes les pièces du module.

## Ce que demande le sujet

- Permettre aux utilisateurs de demander leurs données.
- Suppression des données avec confirmation.

## Ce qui est implémenté

**Export** de toutes les données personnelles (CSV ou JSON, sans secrets) et **suppression du compte avec confirmation par email**, qui anonymise l'utilisateur en conservant l'intégrité des matchs et tournois des autres joueurs.

## Logique utilisée

1. **Export** : `GET /gdpr/export?format=csv|json` → `GdprRepository.collectUserData` rassemble profil, amis, matchs, badges, notifications, messages envoyés… ; `gdpr.csv.ts` produit un CSV unique à sections, protégé contre l'injection de formules ; jamais de hash de mot de passe ni de secret 2FA. Un email confirme l'export.
2. **Suppression** : `POST /gdpr/deletion-request` envoie par email un lien signé valable 1 h (clé de signature dédiée, usage unique) ; `POST /gdpr/deletion-confirm` vérifie le jeton puis `eraseAccount` → `anonymizeUser` efface email, nom, avatar, identifiants, amitiés, conversations, badges, notifications, sessions… et renomme l'utilisateur « Deleted user ». Refusée tant que l'utilisateur a un tournoi ouvert ou joue à une table (`assertDeletable`).
3. **Front** : `ExportDataDialog` (choix du format + téléchargement), `Settings` (section vie privée, demande de suppression), page `/confirm-deletion` (`ConfirmDeletion`), pages légales (`Legal`).

## Fichiers concernés et rôle de chaque fonction

### Backend (NestJS)

**[`backend/src/gdprs/dtos/confirm-deletion.dto.ts`](../../backend/src/gdprs/dtos/confirm-deletion.dto.ts)**

- `ConfirmDeletionDto` ([l.3](../../backend/src/gdprs/dtos/confirm-deletion.dto.ts#L3)) — Corps validé de confirmation de suppression (jeton signé).

**[`backend/src/gdprs/dtos/export-query.dto.ts`](../../backend/src/gdprs/dtos/export-query.dto.ts)**

- `ExportQueryDto` ([l.6](../../backend/src/gdprs/dtos/export-query.dto.ts#L6)) — Paramètre validé de l'export (format csv ou json).

**[`backend/src/gdprs/gdpr.controller.ts`](../../backend/src/gdprs/gdpr.controller.ts)**

- `GdprController` ([l.19](../../backend/src/gdprs/gdpr.controller.ts#L19)) — Contrôleur HTTP RGPD (export des données et suppression du compte) : routes REST protégées par les guards d'authentification.
- `exportData` ([l.25](../../backend/src/gdprs/gdpr.controller.ts#L25)) — GET /gdpr/export?format=json|csv : télécharge toutes les données personnelles de l'utilisateur connecté ; un email l'en informe.
- `requestDeletion` ([l.42](../../backend/src/gdprs/gdpr.controller.ts#L42)) — POST /gdpr/deletion-request : envoie par email un lien de confirmation (1 h) pour supprimer le compte.
- `confirmDeletion` ([l.51](../../backend/src/gdprs/gdpr.controller.ts#L51)) — POST /gdpr/deletion-confirm : public (le jeton signé reçu par email fait foi) ; supprime définitivement le compte.

**[`backend/src/gdprs/gdpr.csv.ts`](../../backend/src/gdprs/gdpr.csv.ts)**

- `Named` ([l.5](../../backend/src/gdprs/gdpr.csv.ts#L5)) — Objet portant un nom d'affichage (pour l'export CSV).
- `cell` ([l.56](../../backend/src/gdprs/gdpr.csv.ts#L56)) — Échappe une cellule CSV ; neutralise l'injection de formules (texte commençant par =, +, -, @) que Excel exécuterait à l'ouverture ; les nombres, mêm…
- `team` ([l.66](../../backend/src/gdprs/gdpr.csv.ts#L66)) — Noms des joueurs d'une équipe, séparés par « & » (le coéquipier est optionnel).
- `toCsv` ([l.74](../../backend/src/gdprs/gdpr.csv.ts#L74)) — Un seul fichier CSV : une section par type de donnée (titre, en-têtes, lignes), séparées par une ligne vide.
- `points` ([l.80](../../backend/src/gdprs/gdpr.csv.ts#L80)) — Extrait du JSON des variations de points d'un match celle de l'utilisateur exporté (null si absente).

**[`backend/src/gdprs/gdpr.messages.ts`](../../backend/src/gdprs/gdpr.messages.ts)**

- `Mail` ([l.3](../../backend/src/gdprs/gdpr.messages.ts#L3)) — Contenu d'un email (sujet, texte) dans une langue.

**[`backend/src/gdprs/gdpr.module.ts`](../../backend/src/gdprs/gdpr.module.ts)**

- `GdprModule` ([l.8](../../backend/src/gdprs/gdpr.module.ts#L8)) — Module NestJS RGPD (export des données et suppression du compte) : regroupe contrôleur, services et dépendances.

**[`backend/src/gdprs/gdpr.repository.ts`](../../backend/src/gdprs/gdpr.repository.ts)**

- `GdprRepository` ([l.9](../../backend/src/gdprs/gdpr.repository.ts#L9)) — Dépôt de données RGPD (export des données et suppression du compte) : requêtes Prisma et conversion en entités.
- `collectUserData` ([l.15](../../backend/src/gdprs/gdpr.repository.ts#L15)) — Toutes les données personnelles d'un utilisateur, sans secrets (hash du mot de passe, secrets 2FA, jetons) ni contenu d'autres personnes (seuls les m…
- `findDeletionBlockers` ([l.134](../../backend/src/gdprs/gdpr.repository.ts#L134)) — Raisons qui empêchent de supprimer le compte : tournois créés encore ouverts, participation à un tournoi non terminé (le tableau serait cassé) ou par…
- `anonymizeUser` ([l.162](../../backend/src/gdprs/gdpr.repository.ts#L162)) — 

**[`backend/src/gdprs/gdpr.service.ts`](../../backend/src/gdprs/gdpr.service.ts)**

- `GdprService` ([l.22](../../backend/src/gdprs/gdpr.service.ts#L22)) — Service métier RGPD (export des données et suppression du compte).
- `constructor` ([l.27](../../backend/src/gdprs/gdpr.service.ts#L27)) — Injecte les dépendances : GdprRepository, MailService, JwtService.
- `deletionSecret` ([l.34](../../backend/src/gdprs/gdpr.service.ts#L34)) — Clé de signature dédiée aux jetons de suppression : dérivée du secret de refresh, jamais acceptée comme access token.
- `mailLanguage` ([l.39](../../backend/src/gdprs/gdpr.service.ts#L39)) — Langue des emails de l'utilisateur, avec repli sur l'anglais.
- `exportData` ([l.46](../../backend/src/gdprs/gdpr.service.ts#L46)) — Droit d'accès / portabilité : toutes les données de l'utilisateur, en JSON (indenté) ou en CSV, plus un email d'information.
- `assertDeletable` ([l.69](../../backend/src/gdprs/gdpr.service.ts#L69)) — Lève une 409 si un tournoi ouvert (créé ou rejoint) ou une partie en cours empêche de supprimer le compte.
- `requestDeletion` ([l.94](../../backend/src/gdprs/gdpr.service.ts#L94)) — Étape 1 de la suppression : refuse si quelque chose bloque, puis envoie un lien de confirmation valable une heure.
- `confirmDeletion` ([l.122](../../backend/src/gdprs/gdpr.service.ts#L122)) — Étape 2 : vérifie le jeton reçu par email, anonymise le compte et efface ses données personnelles (avatar compris) et envoie l'email de confirmation.
- `eraseAccount` ([l.141](../../backend/src/gdprs/gdpr.service.ts#L141)) — Supprime définitivement un compte : refuse si un tournoi ou une partie l'en empêche, anonymise le compte, efface son avatar et envoie l'email de conf…

### Frontend (React)

**[`frontend/src/features/gdpr/ExportDataDialog.tsx`](../../frontend/src/features/gdpr/ExportDataDialog.tsx)**

- `ExportDataDialog` ([l.14](../../frontend/src/features/gdpr/ExportDataDialog.tsx#L14)) — Bouton « Télécharger mes données » : ouvre un choix de format (CSV ou JSON), puis télécharge le fichier.
- `download` ([l.24](../../frontend/src/features/gdpr/ExportDataDialog.tsx#L24)) — Demande l'export des données personnelles dans le format choisi (CSV ou JSON) et déclenche le téléchargement du fichier.

**[`frontend/src/features/gdpr/gdprApi.ts`](../../frontend/src/features/gdpr/gdprApi.ts)**

- `gdprApi` ([l.7](../../frontend/src/features/gdpr/gdprApi.ts#L7)) — Endpoints RTK Query du domaine « gdpr » (requêtes/mutations typées, cache et invalidation par tags) : EXPORT_DATA, REQUEST_DELETION, CONFIRM_DELETION.

**[`frontend/src/pages/ConfirmDeletion.tsx`](../../frontend/src/pages/ConfirmDeletion.tsx)**

- `ConfirmDeletion` ([l.14](../../frontend/src/pages/ConfirmDeletion.tsx#L14)) — Page ouverte depuis le lien de l'email : la suppression n'a lieu qu'au clic (pas au simple chargement de la page).
- `handleConfirm` ([l.39](../../frontend/src/pages/ConfirmDeletion.tsx#L39)) — Confirme la suppression du compte avec le jeton signé du lien reçu par email, puis vide la session locale et le cache.

**[`frontend/src/pages/Legal.tsx`](../../frontend/src/pages/Legal.tsx)**

- `Legal` ([l.9](../../frontend/src/pages/Legal.tsx#L9)) — Pages Politique de confidentialité et Conditions d'utilisation (`kind`), rendues depuis les textes traduits ; accessibles connecté ou non.

**[`frontend/src/pages/Settings.tsx`](../../frontend/src/pages/Settings.tsx)**

- `handleRequestDeletion` ([l.82](../../frontend/src/pages/Settings.tsx#L82)) — Étape 1 de la suppression : envoie l'email de confirmation (le compte n'est pas encore supprimé).

### Autres fichiers liés

- `backend/src/gdprs/gdpr.messages.ts` — Textes des emails RGPD (export, demande et confirmation de suppression) dans les trois langues.
- `backend/src/mail/mail.service.ts` — Envoi des emails (nodemailer/SMTP, Mailpit en dev).

## Comment le démontrer

- Réglages → Vie privée : exporter en CSV et JSON ; demander la suppression puis ouvrir le lien reçu (Mailpit en dev).
