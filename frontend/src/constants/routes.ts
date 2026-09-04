/** Routes React Router (pages frontend). */
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  AUTH_CALLBACK: "/auth/callback",
  PROFILE_ME: "/profile/me",
  /** Pattern React Router */
  PROFILE_BY_ID: "/profile/:id",
  FRIENDS: "/friends",
  SETTINGS: "/settings",
  SETTINGS_2FA: "/settings/2fa",
  profile: (id: string) => `/profile/${id}`,
} as const;
