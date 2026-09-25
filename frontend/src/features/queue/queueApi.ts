import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { QUEUE_ENDPOINTS } from "@/constants/queryEndpoints";

export type QueueEntryStatus =
  | "WAITING"
  | "CALLED"
  | "EXPIRED"
  | "CANCELLED"
  | "DONE";

export interface QueuePlayer {
  id: string;
  displayname: string;
  avatarUrl: string | null;
}

export interface QueueEntry {
  id: string;
  tableId: string;
  status: QueueEntryStatus;
  requester: QueuePlayer;
  joinedAt: string;
  calledAt: string | null;
  expiresAt: string | null;
  position: number;
}

export const queueApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [QUEUE_ENDPOINTS.LIST_QUEUE]: builder.query<QueueEntry[], string>({
      query: (tableId) => API_ROUTES.queueForTable(tableId),
      providesTags: [TAG_TYPES.QUEUE],
    }),
    [QUEUE_ENDPOINTS.GET_MY_QUEUE_ENTRY]: builder.query<QueueEntry | null, void>({
      query: () => API_ROUTES.QUEUE_ME,
      transformResponse: (response: { entry: QueueEntry | null }) => response.entry,
      providesTags: [TAG_TYPES.QUEUE],
    }),
    [QUEUE_ENDPOINTS.JOIN_QUEUE]: builder.mutation<QueueEntry, string>({
      query: (tableId) => ({
        url: API_ROUTES.queueJoin(tableId),
        method: "POST",
      }),
      invalidatesTags: [TAG_TYPES.QUEUE],
    }),
    [QUEUE_ENDPOINTS.LEAVE_QUEUE]: builder.mutation<{ ok: true }, string>({
      query: (entryId) => ({
        url: API_ROUTES.queueEntry(entryId),
        method: "DELETE",
      }),
      invalidatesTags: [TAG_TYPES.QUEUE],
    }),
  }),
});

type Dispatch = (action: unknown) => unknown;

/** Remplace la liste d'attente d'une table dans le cache (réponse websocket). */
export function applyQueueUpdateToCache(
  dispatch: Dispatch,
  tableId: string,
  entries: QueueEntry[],
) {
  dispatch(
    queueApi.util.updateQueryData(
      QUEUE_ENDPOINTS.LIST_QUEUE,
      tableId,
      () => entries,
    ),
  );
  dispatch(queueApi.util.invalidateTags([TAG_TYPES.QUEUE]));
}

export const {
  useListQueueQuery,
  useGetMyQueueEntryQuery,
  useJoinQueueMutation,
  useLeaveQueueMutation,
} = queueApi;
