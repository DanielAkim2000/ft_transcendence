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
  LIST_FRIENDS: "listFriends",
  LIST_PENDING_FRIENDS: "listPendingFriends",
  LIST_OUTGOING_FRIENDS: "listOutgoingFriends",
  SEND_FRIEND_REQUEST: "sendFriendRequest",
  ACCEPT_FRIEND_REQUEST: "acceptFriendRequest",
  REMOVE_FRIEND: "removeFriend",
} as const;
