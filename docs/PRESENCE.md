# Statut online — présence temps réel (WebSocket)

Document de suivi pour la feature **online/offline** via Socket.IO.

---

## ✅ Back — fait

### Infrastructure
- [x] `PresenceGateway` — namespace `/presence`, CORS `FRONTEND_URL`
- [x] `PresenceModule` importé dans `AppModule`
- [x] `JwtModule` global (utilisé par la gateway + auth)
- [x] Auth socket via `client.handshake.auth.access_token`

### Connect / disconnect
- [x] Map en mémoire `userId → Set<socketId>` (multi-onglets)
- [x] `wasOffline` / dernier socket pour ne notifier qu'aux vrais changements
- [x] `client.data.userId` stocké sur le socket
- [x] `client.join(user.id)` — room par user
- [x] `client.disconnect(true)` si token invalide

### Events émis par le serveur
| Event | Destinataire | Payload |
|-------|--------------|---------|
| `presence:sync` | client qui connecte | `{ onlineFriends: [{ userId, status }] }` |
| `presence:update` | amis connectés | `{ userId, status }` |

### Base de données
- [x] `updatePresence(userId, isOnline, status)` — repository + service
- [x] `setUserPresence()` — DB puis notify friends

### Fichiers back
- `backend/src/socket/presence.gateway.ts`
- `backend/src/socket/presence.module.ts`
- `backend/src/users/repositories/users.repository.ts` (`updatePresence`)
- `backend/src/users/services/users.services.ts` (`updatePresence`)

---

## 🔲 Front — à faire

### Étape 1 — Client socket
**Fichier :** `frontend/src/features/presence/presenceSocket.ts`

- [ ] `connect(accessToken)` → `io(\`${VITE_API_URL}/presence\`, { auth: { access_token } })`
- [ ] `disconnect()` → fermer proprement la connexion
- [ ] Exporter une instance singleton (éviter plusieurs connexions)

```ts
// Connexion attendue côté client
io(`${import.meta.env.VITE_API_URL}/presence`, {
  auth: { access_token: accessToken },
});
```

---

### Étape 2 — PresenceBootstrap
**Fichier :** `frontend/src/features/presence/PresenceBootstrap.tsx`

- [ ] Lire `accessToken` depuis Redux (`useAppSelector`)
- [ ] `useEffect` : connect quand token présent, disconnect au cleanup / logout
- [ ] Reconnect si le token change (refresh)
- [ ] Brancher dans `ProtectedLayout` (socket uniquement si authentifié)

```
ProtectedLayout
  └── PresenceBootstrap
        └── Outlet
```

---

### Étape 3 — Écouter les events
Dans `PresenceBootstrap` (ou `presenceListeners.ts`) :

- [ ] `socket.on('presence:sync', ...)` — snapshot initial des amis online
- [ ] `socket.on('presence:update', ...)` — changement en direct
- [ ] Cleanup : `socket.off(...)` au unmount

---

### Étape 4 — Mettre à jour le cache RTK Query
Pas besoin de modifier `Friends.tsx` / `Profile.tsx` si le cache est patché.

Utiliser `api.util.updateQueryData` pour :

- [ ] `listFriends` — liste amis
- [ ] `getUser` — page profil
- [ ] `searchUsers` — recherche (optionnel)

Logique patch :

```ts
// presence:update
isOnline: status === 'ONLINE'
status: status

// presence:sync
// pour chaque onlineFriend → isOnline: true
// (optionnel) remettre offline les amis absents du sync
```

---

### Étape 5 — Logout
- [ ] Le socket se ferme quand `accessToken` → `null` (via cleanup du `useEffect`)
- [ ] Vérifier que `logout` appelle bien `clearCredentials`

---

### Étape 6 — Tests manuels
- [ ] 2 navigateurs, 2 comptes amis
- [ ] A connecte → B voit ● online
- [ ] A ferme onglet → B voit ○ offline
- [ ] A 2 onglets → fermer 1 ne change rien, fermer le 2e → offline
- [ ] B se connecte alors qu'A est déjà online → B reçoit `presence:sync`
- [ ] Rechargement page profil → statut correct via REST (DB)

---

## Contrat API socket (rappel)

### Auth handshake
```ts
auth: { access_token: string }  // JWT access token
```

### Events serveur → client

**presence:sync** (à chaque connect)
```json
{
  "onlineFriends": [
    { "userId": "...", "status": "ONLINE" }
  ]
}
```

**presence:update** (changement online/offline d'un ami)
```json
{
  "userId": "...",
  "status": "ONLINE" | "OFFLINE"
}
```

---

## Plus tard (hors scope immédiat)

- [ ] Statut `IN_GAME` quand un match démarre
- [ ] Reset `isOnline` au boot serveur (crash/restart)
- [ ] Tests e2e socket

---

## Infra Docker (déjà commité)

- Limites CPU/RAM en dev (`docker-compose.dev.yml`)
- `CI: "true"` sur le frontend dev (fix pnpm sans TTY)
