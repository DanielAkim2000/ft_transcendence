import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { QUEUE_ENDPOINTS } from "@/constants/queryEndpoints";
import type { MatchFormat } from "@/features/matches/matchesApi";

export type QueueGroupStatus =
  | "INVITING"
  | "WAITING"
  | "CALLED"
  | "ON_TABLE"
  | "DONE"
  | "EXPIRED"
  | "CANCELLED";

export interface QueuePlayer {
  id: string;
  displayname: string;
  avatarUrl: string | null;
  isRequester: boolean;
  /** false tant que le coéquipier n'a pas accepté l'invitation. */
  accepted: boolean;
}

export interface QueueGroup {
  id: string;
  tableId: string;
  format: MatchFormat;
  status: QueueGroupStatus;
  players: QueuePlayer[];
  joinedAt: string;
  calledAt: string | null;
  expiresAt: string | null;
  position: number;
}

export interface JoinQueueArgs {
  tableId: string;
  format?: MatchFormat;
  teammateId?: string;
}

/** [Socle produit babyfoot (hors module)] Endpoints RTK Query du domaine « queue » (requêtes/mutations typées, cache et invalidation par tags) : LIST_QUEUE, GET_MY_QUEUE_GROUP, JOIN_QUEUE, RESPOND_INVITE, CONFIRM_GROUP, LEAVE_GROUP. */
export const queueApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [QUEUE_ENDPOINTS.LIST_QUEUE]: builder.query<QueueGroup[], string>({
      query: (tableId) => API_ROUTES.queueForTable(tableId),
      providesTags: [TAG_TYPES.QUEUE],
    }),
    [QUEUE_ENDPOINTS.GET_MY_QUEUE_GROUP]: builder.query<QueueGroup | null, void>({
      query: () => API_ROUTES.QUEUE_ME,
      transformResponse: (response: { group: QueueGroup | null }) => response.group,
      providesTags: [TAG_TYPES.QUEUE],
    }),
    [QUEUE_ENDPOINTS.JOIN_QUEUE]: builder.mutation<QueueGroup, JoinQueueArgs>({
      query: ({ tableId, ...body }) => ({
        url: API_ROUTES.queueJoin(tableId),
        method: "POST",
        body,
      }),
      invalidatesTags: [TAG_TYPES.QUEUE, TAG_TYPES.TABLES],
    }),
    [QUEUE_ENDPOINTS.RESPOND_INVITE]: builder.mutation<
      { group: QueueGroup | null },
      { groupId: string; accept: boolean }
    >({
      query: ({ groupId, accept }) => ({
        url: API_ROUTES.queueGroupRespond(groupId),
        method: "POST",
        body: { accept },
      }),
      invalidatesTags: [TAG_TYPES.QUEUE, TAG_TYPES.TABLES],
    }),
    [QUEUE_ENDPOINTS.CONFIRM_GROUP]: builder.mutation<QueueGroup, string>({
      query: (groupId) => ({
        url: API_ROUTES.queueGroupConfirm(groupId),
        method: "POST",
      }),
      invalidatesTags: [TAG_TYPES.QUEUE, TAG_TYPES.TABLES],
    }),
    [QUEUE_ENDPOINTS.LEAVE_GROUP]: builder.mutation<{ ok: true }, string>({
      query: (groupId) => ({
        url: API_ROUTES.queueGroup(groupId),
        method: "DELETE",
      }),
      invalidatesTags: [TAG_TYPES.QUEUE, TAG_TYPES.TABLES],
    }),
  }),
});

type Dispatch = (action: unknown) => unknown;

/** [Socle produit babyfoot (hors module)] Remplace la file d'attente d'une table dans le cache (réponse websocket). */
export function applyQueueUpdateToCache(
  dispatch: Dispatch,
  tableId: string,
  groups: QueueGroup[],
) {
  dispatch(
    queueApi.util.updateQueryData(
      QUEUE_ENDPOINTS.LIST_QUEUE,
      tableId,
      () => groups,
    ),
  );
  dispatch(queueApi.util.invalidateTags([TAG_TYPES.QUEUE]));
}

export const {
  useListQueueQuery,
  useGetMyQueueGroupQuery,
  useJoinQueueMutation,
  useRespondQueueInviteMutation,
  useConfirmQueueGroupMutation,
  useLeaveQueueGroupMutation,
} = queueApi;
