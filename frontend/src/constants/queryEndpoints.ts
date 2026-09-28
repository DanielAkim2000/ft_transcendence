/** Noms des endpoints RTK Query — authApi */
export const AUTH_ENDPOINTS = {
  REGISTER: "register",
  LOGIN: "login",
  REFRESH: "refresh",
  LOGOUT: "logout",
  ME: "me",
  CHECK_2FA_PENDING: "check2faPending",
  VERIFY_2FA: "verify2fa",
  SETUP_2FA: "setup2fa",
  TOGGLE_2FA: "toggle2fa",
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
} as const;

/** Noms des endpoints RTK Query — tournamentsApi */
export const TOURNAMENTS_ENDPOINTS = {
  LIST_TOURNAMENTS: "listTournaments",
  COUNT_TOURNAMENT_ACTIONS: "countTournamentActions",
  GET_TOURNAMENT: "getTournament",
  CREATE_TOURNAMENT: "createTournament",
  ADD_ENTRY: "addTournamentEntry",
  REMOVE_ENTRY: "removeTournamentEntry",
  LAUNCH_TOURNAMENT: "launchTournament",
  CANCEL_TOURNAMENT: "cancelTournament",
} as const;

/** Noms des endpoints RTK Query — badgesApi */
export const BADGES_ENDPOINTS = {
  GET_BADGES: "getBadges",
} as const;
