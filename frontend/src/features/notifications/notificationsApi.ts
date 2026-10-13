import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { NOTIFICATIONS_ENDPOINTS } from "@/constants/queryEndpoints";
import type { PageArgs, Paginated } from "@/lib/pagination";

export type NotificationType =
  | "FRIEND_REQUEST"
  | "MATCH_PROPOSED"
  | "MATCH_ACCEPTED"
  | "MATCH_DECLINED"
  | "MATCH_SCORE_SUBMITTED"
  | "MATCH_COMPLETED"
  | "MATCH_DISPUTED"
  | "QUEUE_INVITE"
  | "QUEUE_INVITE_DECLINED"
  | "QUEUE_GROUP_CLOSED"
  | "QUEUE_CALLED"
  | "QUEUE_EXPIRED"
  | "TABLE_MATCH_STARTED"
  | "TABLE_SCORE_REQUIRED"
  | "TABLE_MATCH_ENDED"
  | "TABLE_MATCH_CANCELLED"
  | "TOURNAMENT_LAUNCHED"
  | "TOURNAMENT_TABLE_RECLAIMED"
  | "TOURNAMENT_TIE_STARTED"
  | "TOURNAMENT_TIE_WON"
  | "TOURNAMENT_ELIMINATED"
  | "TOURNAMENT_COMPLETED"
  | "BADGE_EARNED"
  | "CHESS_INVITE"
  | "CHESS_INVITE_ACCEPTED"
  | "CHESS_INVITE_DECLINED"
  | "TOURNAMENT_SCORE_CORRECTED"
  | "TOURNAMENT_TIE_RESET";

export interface AppNotification {
  id: string;
  type: NotificationType;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

/** [Minor · Notifications] Endpoints RTK Query du domaine « notifications » (requêtes/mutations typées, cache et invalidation par tags) : LIST_NOTIFICATIONS, COUNT_UNREAD_NOTIFICATIONS, MARK_ALL_NOTIFICATIONS_READ. */
export const notificationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [NOTIFICATIONS_ENDPOINTS.LIST_NOTIFICATIONS]: builder.query<
      Paginated<AppNotification>,
      PageArgs | void
    >({
      query: (args) => ({ url: API_ROUTES.NOTIFICATIONS, params: args ?? undefined }),
      providesTags: [TAG_TYPES.NOTIFICATIONS],
    }),
    [NOTIFICATIONS_ENDPOINTS.COUNT_UNREAD_NOTIFICATIONS]: builder.query<
      { count: number },
      void
    >({
      query: () => API_ROUTES.NOTIFICATIONS_UNREAD_COUNT,
      providesTags: [TAG_TYPES.NOTIFICATIONS],
    }),
    [NOTIFICATIONS_ENDPOINTS.MARK_ALL_NOTIFICATIONS_READ]: builder.mutation<
      { count: number },
      void
    >({
      query: () => ({ url: API_ROUTES.NOTIFICATIONS_READ_ALL, method: "POST" }),
      invalidatesTags: [TAG_TYPES.NOTIFICATIONS],
    }),
  }),
});

export const {
  useListNotificationsQuery,
  useCountUnreadNotificationsQuery,
  useMarkAllNotificationsReadMutation,
} = notificationsApi;
