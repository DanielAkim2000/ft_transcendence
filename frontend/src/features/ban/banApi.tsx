import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { BAN_ENDPOINTS } from "@/constants/queryEndpoints";

export interface Ban {
  id: string;
  userId: string;
  startTime: string;
  /** null = ban permanent. */
  endTime: string | null;
  reason: string;
}

export interface BanRequest {
  userId: string;
  /** 0 = permanent. */
  durationHours: number;
  reason: string;
}

/** [Major · Permissions avancées] Endpoints RTK Query du domaine « ban » (requêtes/mutations typées, cache et invalidation par tags) : GET_ACTIVE_BAN, GET_BAN_HISTORY, BAN_USER, UNBAN_USER. */
export const banApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // `ban` vaut null quand l'utilisateur n'est pas banni.
    [BAN_ENDPOINTS.GET_ACTIVE_BAN]: builder.query<{ ban: Ban | null }, string>({
      query: (userId) => API_ROUTES.ban(userId),
      providesTags: (_result, _error, userId) => [{ type: TAG_TYPES.BAN, id: userId }],
    }),
    [BAN_ENDPOINTS.GET_BAN_HISTORY]: builder.query<Ban[], string>({
      query: (userId) => API_ROUTES.banHistory(userId),
      providesTags: (_result, _error, userId) => [{ type: TAG_TYPES.BAN, id: userId }],
    }),
    [BAN_ENDPOINTS.BAN_USER]: builder.mutation<Ban, BanRequest>({
      query: ({ userId, ...body }) => ({
        url: API_ROUTES.ban(userId),
        method: "POST",
        body,
      }),
      // USERS : la liste admin affiche le ban en cours de chaque utilisateur.
      invalidatesTags: (_result, _error, { userId }) => [
        { type: TAG_TYPES.BAN, id: userId },
        TAG_TYPES.USERS,
      ],
    }),
    [BAN_ENDPOINTS.UNBAN_USER]: builder.mutation<{ message: string }, string>({
      query: (userId) => ({ url: API_ROUTES.banLift(userId), method: "POST" }),
      invalidatesTags: (_result, _error, userId) => [
        { type: TAG_TYPES.BAN, id: userId },
        TAG_TYPES.USERS,
      ],
    }),
  }),
});

export const {
  useGetActiveBanQuery,
  useGetBanHistoryQuery,
  useBanUserMutation,
  useUnbanUserMutation,
} = banApi;
