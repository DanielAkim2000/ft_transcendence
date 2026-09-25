/** Chemins HTTP du backend (relatifs à VITE_API_URL). */
export const API_ROUTES = {
  AUTH_REGISTER: "/auth/register",
  AUTH_LOGIN: "/auth/login",
  AUTH_REFRESH: "/auth/refresh",
  AUTH_LOGOUT: "/auth/logout",
  AUTH_ME: "/auth/me",
  AUTH_2FA_PENDING: "/auth/2fa/pending",
  AUTH_2FA_VERIFY: "/auth/2fa/verify",
  AUTH_2FA_SETUP: "/auth/2fa/setup",
  AUTH_2FA_TOGGLE: "/auth/2fa/toggle",
  AUTH_42_LOGIN: "/auth/42/login",

  USERS: "/users",
  USERS_RANKING: "/users/ranking",
  USERS_ME: "/users/me",
  USERS_ME_SETTINGS: "/users/me/settings",
  USERS_ME_AVATAR: "/users/me/avatar",
  USERS_ME_FRIENDS: "/users/me/friends",
  USERS_ME_FRIENDS_PENDING: "/users/me/friends/pending",
  USERS_ME_FRIENDS_OUTGOING: "/users/me/friends/outgoing",
  user: (id: string) => `/users/${id}`,
  friend: (userId: string) => `/users/me/friends/${userId}`,
  friendAccept: (userId: string) => `/users/me/friends/${userId}/accept`,

  TABLES: "/tables",
  tableOccupy: (tableId: string) => `/tables/${tableId}/occupy`,
  tableRelease: (tableId: string) => `/tables/${tableId}/release`,

  QUEUE_ME: "/queue/me",
  queueForTable: (tableId: string) => `/queue/${tableId}`,
  queueJoin: (tableId: string) => `/queue/${tableId}/join`,
  queueEntry: (entryId: string) => `/queue/${entryId}`,

  MATCHES: "/matches",
  MATCHES_ME: "/matches/me",
  MATCHES_HISTORY: "/matches/me/history",
  match: (matchId: string) => `/matches/${matchId}`,
  matchRespond: (matchId: string) => `/matches/${matchId}/respond`,
  matchScore: (matchId: string) => `/matches/${matchId}/score`,
  matchValidate: (matchId: string) => `/matches/${matchId}/validate`,

  TOURNAMENTS: "/tournaments",
  tournament: (id: string) => `/tournaments/${id}`,
  tournamentEntries: (id: string) => `/tournaments/${id}/entries`,
  tournamentEntry: (id: string, entryId: string) => `/tournaments/${id}/entries/${entryId}`,
  tournamentLaunch: (id: string) => `/tournaments/${id}/launch`,
  tournamentCancel: (id: string) => `/tournaments/${id}/cancel`,

  badges: (userId: string) => `/badges/${userId}`,

  CHAT_CONVERSATIONS: "/chat/conversations",
  CHAT_BLOCKS: "/chat/blocks",
  chatMessages: (conversationId: string) =>
    `/chat/conversations/${conversationId}/messages`,
  chatRead: (conversationId: string) =>
    `/chat/conversations/${conversationId}/read`,
  chatBlock: (userId: string) => `/chat/blocks/${userId}`,
} as const;

/** Endpoints pour lesquels un 401 ne déclenche pas de refresh token. */
export const AUTH_NO_REFRESH_PATHS = [
  API_ROUTES.AUTH_REFRESH,
  API_ROUTES.AUTH_LOGIN,
  API_ROUTES.AUTH_LOGOUT,
  API_ROUTES.AUTH_REGISTER,
  API_ROUTES.AUTH_2FA_VERIFY,
  API_ROUTES.AUTH_2FA_TOGGLE,
  API_ROUTES.AUTH_2FA_SETUP,
  API_ROUTES.AUTH_2FA_PENDING,
] as const;
