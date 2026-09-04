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
  USERS_ME: "/users/me",
  USERS_ME_SETTINGS: "/users/me/settings",
  USERS_ME_AVATAR: "/users/me/avatar",
  USERS_ME_FRIENDS: "/users/me/friends",
  USERS_ME_FRIENDS_PENDING: "/users/me/friends/pending",
  USERS_ME_FRIENDS_OUTGOING: "/users/me/friends/outgoing",
  user: (id: string) => `/users/${id}`,
  friend: (userId: string) => `/users/me/friends/${userId}`,
  friendAccept: (userId: string) => `/users/me/friends/${userId}/accept`,
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
