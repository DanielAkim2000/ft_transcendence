import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "./index";
import { TAG_TYPES } from "@/constants/tagTypes";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { setAccessToken, clearCredentials } from "@/features/auth/authSlice";
import { API_ROUTES, AUTH_NO_REFRESH_PATHS } from "@/constants/apiRoutes";
import { banLoginPath } from "@/features/ban/banHelpers";
import { navigate } from "@/lib/navigation";

/** [Major · Frameworks React + NestJS] Client HTTP de base : URL de l'API, cookies inclus (refresh httpOnly) et en-tête Authorization Bearer ajouté depuis l'access token du store. */
const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL,
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

/** [Major · Frameworks React + NestJS] Enveloppe du client HTTP : sur ban (403 BAN) coupe la session ; sur 401 d'une vraie session tente un seul refresh du token puis rejoue la requête, sinon vide la session. */
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  // Compte banni (en pleine session ou à la connexion) : on coupe la session et on explique le ban sur la page de connexion.
  if (result.error?.status === 403) {
    const data = result.error.data as
      | { code?: string; reason?: string; endTime?: string | null }
      | undefined;
    if (data?.code === "BAN") {
      api.dispatch(clearCredentials());
      navigate(banLoginPath(data.reason ?? "", data.endTime ?? null));
      return result;
    }
  }

  if (result.error && result.error.status === 401) {
    const url = typeof args === "string" ? args : args.url;
    // Pas un access token expiré : mauvais credentials / mauvais code 2FA
    if (AUTH_NO_REFRESH_PATHS.some((path) => url.includes(path))) {
      return result;
    }

    // Refresh uniquement pour une vraie session (access token)
    const state = api.getState() as RootState;
    if (!state.auth.accessToken) {
      return result;
    }

    const refreshResult = await baseQuery(
      { url: API_ROUTES.AUTH_REFRESH, method: "POST" },
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

/** [Major · Frameworks React + NestJS] Instance RTK Query unique de l'application : cache et tags d'invalidation ; chaque domaine y injecte ses endpoints (injectEndpoints). */
export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  endpoints: () => ({}),
  tagTypes: Object.values(TAG_TYPES),
});
