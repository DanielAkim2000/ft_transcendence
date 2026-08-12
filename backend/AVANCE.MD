Déjà en place (prérequis OK pour Auth 42)
Prisma : schema User, migration, PrismaModule + PrismaService
Config : ConfigModule global, DATABASE_URL + CLIENT_ID / CLIENT_SECRET dans .env
Nest : backend sur le port 3000 (main.ts)
Intra 42 : app créée (étape 3, côté Intra)
Tu peux attaquer l’Auth 42.

Étape 4 — tout ce qui manque
A. Dépendances à installer
@nestjs/passport + passport + passport-42 (approche classique Nest)
ou axios / fetch natif si tu fais le flow OAuth à la main (sans Passport)
B. Variables d’env à ajouter
Tu as CLIENT_ID / CLIENT_SECRET, il manque surtout :

FT_CALLBACK_URL (ou REDIRECT_URI) → ex. http://localhost:3000/auth/42/callback
Doit être identique à ce que tu as mis sur l’Intra 42
(optionnel mais utile) FRONTEND_URL pour rediriger après login
À mettre aussi dans .env.example quand tu y passes.

C. Structure src/auth/ à créer
auth.module.ts
auth.controller.ts → routes /auth/42/login et /auth/42/callback
auth.service.ts → logique métier (upsert user)
strategies/forty-two.strategy.ts (si Passport)
Puis importer AuthModule dans AppModule.

D. GET /auth/42/login
Redirige vers https://api.intra.42.fr/oauth/authorize
Params : client_id, redirect_uri, response_type=code, scope=public
Avec Passport : @UseGuards(AuthGuard('42')) sur la route login.

E. GET /auth/42/callback
Flow complet :

Récupérer le code en query
POST https://api.intra.42.fr/oauth/token → access_token
GET https://api.intra.42.fr/v2/me avec Authorization: Bearer <token>
Mapper le profil 42 → ton modèle User :
login42 ← login
email ← email
displayname ← displayname
avatarUrl ← image.link
Upsert Prisma sur login42 (create si absent, update sinon)
Répondre (JSON user pour l’instant, ou redirect front — à trancher)
F. Logique upsert dans AuthService
prisma.user.upsert({ where: { login42 }, create: {...}, update: {...} })
Ne pas écraser role, twoFactorEnabled, twoFactorSecret au update (données sensibles / déjà en DB)
G. Brancher Prisma dans Auth
Injecter PrismaService dans AuthService
AuthModule importe PrismaModule
H. Test manuel (critère “étape 4 done”)
pnpm start:dev dans backend
Ouvrir http://localhost:3000/auth/42/login
Autoriser sur Intra
Callback OK
User créé/mis à jour en Postgres
Pièges à éviter
Piège	Solution
Redirect URI différente Intra / .env / port
Les 3 doivent matcher exactement
Callback en POST
42 renvoie en GET
Upsert sur email
Clé stable = login42
Secrets dans le repo
.env gitignoré, secrets dans .env.example en placeholder
Hors scope étape 4 (plus tard)
JWT / session (connexion persistante)
2FA
Seed
Module Users CRUD complet
Ordre conseillé pour ne pas poiroter
Env + redirect URI alignés avec l’Intra
AuthModule + controller avec les 2 routes (même vides)
Strategy Passport ou appels HTTP manuels token + /v2/me
Upsert Prisma dans AuthService
Test navigateur bout en bout
Quand tu as le squelette auth/ branché (même incomplet), envoie-le et on valide avant d’aller plus loin.