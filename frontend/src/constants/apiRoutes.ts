/** Chemins HTTP du backend (relatifs à VITE_API_URL). */
export const API_ROUTES = {
  AUTH_REGISTER: "/auth/register",
  AUTH_LOGIN: "/auth/login",
  AUTH_REFRESH: "/auth/refresh",
  AUTH_LOGOUT: "/auth/logout",
  AUTH_FORGOT_PASSWORD: "/auth/forgot-password",
  AUTH_RESET_PASSWORD: "/auth/reset-password",
  AUTH_ME: "/auth/me",
  AUTH_2FA_PENDING: "/auth/2fa/pending",
  AUTH_2FA_VERIFY: "/auth/2fa/verify",
  AUTH_2FA_SETUP: "/auth/2fa/setup",
  AUTH_2FA_TOGGLE: "/auth/2fa/toggle",
  AUTH_2FA_USE_RECOVERY_CODE: "/auth/2fa/use-recovery-code",
  AUTH_2FA_RECOVERY_CODES: "/auth/2fa/recovery-codes",
  AUTH_2FA_RECOVERY_CODES_REGENERATE: "/auth/2fa/recovery-codes/regenerate",
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

  ADMIN_USERS: "/admin/users",
  adminUser: (id: string) => `/admin/users/${id}`,

  ban: (userId: string) => `/ban/${userId}`,
  banHistory: (userId: string) => `/ban/${userId}/history`,
  banLift: (userId: string) => `/ban/${userId}/unban`,

  HEALTH: "/health",

  GDPR_EXPORT: "/gdpr/export",
  GDPR_DELETION_REQUEST: "/gdpr/deletion-request",
  GDPR_DELETION_CONFIRM: "/gdpr/deletion-confirm",

  TABLES: "/tables",
  table: (id: string) => `/tables/${id}`,

  QUEUE_ME: "/queue/me",
  queueForTable: (tableId: string) => `/queue/${tableId}`,
  queueJoin: (tableId: string) => `/queue/${tableId}/join`,
  queueReleaseVote: (tableId: string) => `/queue/${tableId}/release-vote`,
  queueAdminRelease: (tableId: string) => `/queue/${tableId}/admin-release`,
  queueGroup: (groupId: string) => `/queue/groups/${groupId}`,
  queueGroupRespond: (groupId: string) => `/queue/groups/${groupId}/respond`,
  queueGroupConfirm: (groupId: string) => `/queue/groups/${groupId}/confirm`,

  MATCHES: "/matches",
  MATCHES_ME: "/matches/me",
  MATCHES_HISTORY: "/matches/me/history",
  MATCHES_PENDING_ACTIONS: "/matches/me/pending-actions",
  match: (matchId: string) => `/matches/${matchId}`,
  matchRespond: (matchId: string) => `/matches/${matchId}/respond`,
  matchScore: (matchId: string) => `/matches/${matchId}/score`,
  matchAdminScore: (matchId: string) => `/matches/${matchId}/admin-score`,
  matchValidate: (matchId: string) => `/matches/${matchId}/validate`,

  TOURNAMENTS: "/tournaments",
  TOURNAMENTS_PENDING_ACTIONS: "/tournaments/me/pending-actions",
  tournament: (id: string) => `/tournaments/${id}`,
  tournamentEntries: (id: string) => `/tournaments/${id}/entries`,
  tournamentEntry: (id: string, entryId: string) => `/tournaments/${id}/entries/${entryId}`,
  tournamentEntryPlayer: (id: string, entryId: string) => `/tournaments/${id}/entries/${entryId}/player`,
  tournamentLaunch: (id: string) => `/tournaments/${id}/launch`,
  tournamentCancel: (id: string) => `/tournaments/${id}/cancel`,

  badges: (userId: string) => `/badges/${userId}`,
  
  CHESS_GAMES: "/chess/games",
  CHESS_GAMES_AI: "/chess/games/ai",
  CHESS_GAMES_HISTORY: "/chess/games/history",
  CHESS_GAMES_ME: "/chess/games/me",
  chessGame: (gameId: string) => `/chess/games/${gameId}`,
  chessGameMoves: (gameId: string) => `/chess/games/${gameId}/moves`,
  chessGameAccept: (gameId: string) => `/chess/games/${gameId}/accept`,
  chessGameDecline: (gameId: string) => `/chess/games/${gameId}/decline`,

  NOTIFICATIONS: "/notifications",
  NOTIFICATIONS_UNREAD_COUNT: "/notifications/unread-count",
  NOTIFICATIONS_READ_ALL: "/notifications/read-all",

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
  API_ROUTES.AUTH_2FA_USE_RECOVERY_CODE,
  API_ROUTES.AUTH_2FA_RECOVERY_CODES_REGENERATE,
  API_ROUTES.AUTH_2FA_SETUP,
  API_ROUTES.AUTH_2FA_PENDING,
] as const;
