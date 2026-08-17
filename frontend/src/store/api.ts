import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "./index";
import { TAG_TYPES } from "@/constants/tagTypes";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { setAccessToken, clearCredentials } from "@/features/auth/authSlice";

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL,
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (!token) {
      const preAuthToken = (getState() as RootState).auth.preAuthToken;
      if (preAuthToken) {
        headers.set("Authorization", `Bearer ${preAuthToken}`);
      }
    }
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const url = typeof args === "string" ? args : args.url;
    // Pas un access token expiré : mauvais credentials / mauvais code 2FA
    if (
      url.includes("/auth/refresh") ||
      url.includes("/auth/login") ||
      url.includes("/auth/logout") ||
      url.includes("/auth/register") ||
      url.includes("/auth/2fa/verify") ||
      url.includes("/auth/2fa/toggle") ||
      url.includes("/auth/2fa/setup")
    ) {
      return result;
    }

    // Refresh uniquement pour une vraie session (access token)
    const state = api.getState() as RootState;
    if (!state.auth.accessToken) {
      return result;
    }

    const refreshResult = await baseQuery(
      { url: "/auth/refresh", method: "POST" },
      api,
      extraOptions,
    );

    if (refreshResult.data) {
      const data = refreshResult.data as { accessToken: string };
      api.dispatch(setAccessToken({ accessToken: data.accessToken }));
      result = await baseQuery(args, api, extraOptions);
    } else {
      api.dispatch(clearCredentials());
    }
  }

  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
  tagTypes: Object.values(TAG_TYPES),
});
