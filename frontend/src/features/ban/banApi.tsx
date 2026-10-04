import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { AUTH_ENDPOINTS, BAN_ENDPOINTS } from "@/constants/queryEndpoints";
import { authApi, type User } from "@/features/auth/authApi";
import type { PageArgs, Paginated } from "@/lib/pagination";
import type {
  LanguagePreference,
  ThemePreference,
} from "../settings/settingsSlice";

export interface Ban {
  id: string,
  userId: string,
  startTime: Date,
  endTime: Date | null,
  reason: string,
};

export const banApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [BAN_ENDPOINTS.GET_BAN_STATUS]: builder.query<boolean, string>({
      query: (userId) => `/ban/${userId}/status`,
      providesTags: (_result, _error, userId) => [{ type: TAG_TYPES.BAN, id: userId }],
    }),
    [BAN_ENDPOINTS.GET_BAN_HISTORY]: builder.query<Ban[], string>({
      query: (userId) => `/ban/${userId}/history`,
      providesTags: (_result, _error, userId) => [{ type: TAG_TYPES.BAN, id: userId }],
    }),
    [BAN_ENDPOINTS.BAN_USER]: builder.mutation<void,{ userId: string, durationHours?: number, reason: string }>({
      query: ({ userId, ...body }) => ({ url: `/ban/${userId}`, method: "POST", body}),
      invalidatesTags: (_result, _error, { userId }) => [{ type: TAG_TYPES.BAN, id: userId }],
    }),
    [BAN_ENDPOINTS.UNBAN_USER]: builder.mutation<void, string>({
      query: (userId) => ({ url: `/ban/${userId}/unban`, method: "POST"}),
      invalidatesTags: (_result, _error, userId) => [{ type: TAG_TYPES.BAN, id: userId }],
    }),
  })
});

export const {
  useGetBanStatusQuery,
  useGetBanHistoryQuery,
  useBanUserMutation,
  useUnbanUserMutation,
} = banApi;
