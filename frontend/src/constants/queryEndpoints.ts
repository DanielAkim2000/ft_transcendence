/** Noms des endpoints RTK Query — authApi */
export const AUTH_ENDPOINTS = {
  REGISTER: "register",
  LOGIN: "login",
  REFRESH: "refresh",
  LOGOUT: "logout",
  FORGOT_PASSWORD: "forgotPassword",
  RESET_PASSWORD: "resetPassword",
  ME: "me",
  CHECK_2FA_PENDING: "check2faPending",
  VERIFY_2FA: "verify2fa",
  SETUP_2FA: "setup2fa",
  TOGGLE_2FA: "toggle2fa",
  USE_RECOVERY_CODE: "useRecoveryCode",
  GET_RECOVERY_CODES_STATUS: "getRecoveryCodesStatus",
  REGENERATE_RECOVERY_CODES: "regenerateRecoveryCodes",
} as const;

/** Noms des endpoints RTK Query — usersApi */
export const USERS_ENDPOINTS = {
  SEARCH_USERS: "searchUsers",
  GET_USER: "getUser",
  UPDATE_PROFILE: "updateProfile",
  UPDATE_SETTINGS: "updateSettings",
  UPLOAD_AVATAR: "uploadAvatar",
  GET_RANKING: "getRanking",
  LIST_FRIENDS: "listFriends",
  LIST_PENDING_FRIENDS: "listPendingFriends",
  LIST_OUTGOING_FRIENDS: "listOutgoingFriends",
  SEND_FRIEND_REQUEST: "sendFriendRequest",
  ACCEPT_FRIEND_REQUEST: "acceptFriendRequest",
  REMOVE_FRIEND: "removeFriend",
} as const;

/** Noms des endpoints RTK Query — chatApi */
export const CHAT_ENDPOINTS = {
  LIST_CONVERSATIONS: "listConversations",
  CREATE_CONVERSATION: "createConversation",
  GET_MESSAGES: "getMessages",
  SEND_MESSAGE: "sendMessage",
  MARK_READ: "markConversationRead",
  IS_BLOCKED: "isBlocked",
  BLOCK_USER: "blockUser",
  UNBLOCK_USER: "unblockUser",
} as const;

/** Noms des endpoints RTK Query — tablesApi */
export const TABLES_ENDPOINTS = {
  LIST_TABLES: "listTables",
  VOTE_RELEASE_TABLE: "voteReleaseTable",
  CREATE_TABLE: "createTable",
  RENAME_TABLE: "renameTable",
  DELETE_TABLE: "deleteTable",
  ADMIN_RELEASE_TABLE: "adminReleaseTable",
} as const;

/** Noms des endpoints RTK Query — queueApi */
export const QUEUE_ENDPOINTS = {
  LIST_QUEUE: "listQueue",
  GET_MY_QUEUE_GROUP: "getMyQueueGroup",
  JOIN_QUEUE: "joinQueue",
  RESPOND_INVITE: "respondQueueInvite",
  CONFIRM_GROUP: "confirmQueueGroup",
  LEAVE_GROUP: "leaveQueueGroup",
} as const;

/** Noms des endpoints RTK Query — matchesApi */
export const MATCHES_ENDPOINTS = {
  LIST_MATCHES: "listMatches",
  LIST_MATCH_HISTORY: "listMatchHistory",
  COUNT_MATCH_ACTIONS: "countMatchActions",
  PROPOSE_MATCH: "proposeMatch",
  RESPOND_MATCH: "respondMatch",
  SUBMIT_SCORE: "submitScore",
  VALIDATE_SCORE: "validateScore",
  SUBMIT_TOURNAMENT_SCORE: "submitTournamentScore",
  CORRECT_TOURNAMENT_SCORE: "correctTournamentScore",
} as const;

/** Noms des endpoints RTK Query — tournamentsApi */
export const TOURNAMENTS_ENDPOINTS = {
  LIST_TOURNAMENTS: "listTournaments",
  COUNT_TOURNAMENT_ACTIONS: "countTournamentActions",
  GET_TOURNAMENT: "getTournament",
  CREATE_TOURNAMENT: "createTournament",
  ADD_ENTRY: "addTournamentEntry",
  REMOVE_ENTRY: "removeTournamentEntry",
  REPLACE_PLAYER: "replaceTournamentPlayer",
  LAUNCH_TOURNAMENT: "launchTournament",
  CANCEL_TOURNAMENT: "cancelTournament",
} as const;

/** Noms des endpoints RTK Query — badgesApi */
export const BADGES_ENDPOINTS = {
  GET_BADGES: "getBadges",
} as const;

/** Noms des endpoints RTK Query — notificationsApi */
export const NOTIFICATIONS_ENDPOINTS = {
  LIST_NOTIFICATIONS: "listNotifications",
  COUNT_UNREAD_NOTIFICATIONS: "countUnreadNotifications",
  MARK_ALL_NOTIFICATIONS_READ: "markAllNotificationsRead",
} as const;

/** Noms des endpoints RTK Query — healthApi */
export const HEALTH_ENDPOINTS = {
  GET_HEALTH: "getHealth",
} as const;

/** Noms des endpoints RTK Query — gdprApi */
export const GDPR_ENDPOINTS = {
  EXPORT_DATA: "exportMyData",
  REQUEST_DELETION: "requestAccountDeletion",
  CONFIRM_DELETION: "confirmAccountDeletion",
} as const;

/** Noms des endpoints RTK Query — chessApi */
export const CHESS_ENDPOINTS = {
  LIST_GAMES: "listChessGames",
  CREATE_GAME: "createChessGame",
  GET_GAME: "getChessGame",
  ACCEPT_GAME: "acceptChessGame",
  DECLINE_GAME: "declineChessGame",
} as const;

/** Noms des endpoints RTK Query — banApi */
export const BAN_ENDPOINTS = {
  GET_ACTIVE_BAN: "getActiveBan",
  GET_BAN_HISTORY: "getBanHistory",
  BAN_USER: "banUser",
  UNBAN_USER: "unbanUser",
} as const;

/** Noms des endpoints RTK Query — adminApi */
export const ADMIN_ENDPOINTS = {
  LIST_USERS: "adminListUsers",
  CREATE_USER: "adminCreateUser",
  UPDATE_USER: "adminUpdateUser",
  DELETE_USER: "adminDeleteUser",
} as const;
