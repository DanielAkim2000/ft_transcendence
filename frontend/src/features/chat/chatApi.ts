import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { CHAT_ENDPOINTS } from "@/constants/queryEndpoints";
import type { User } from "@/features/auth/authApi";

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userAId: string;
  userBId: string;
  lastMessage?: Message;
  unreadCount: number;
  peerLastReadAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessagesArg {
  conversationId: string;
  cursor?: string;
}

export const MESSAGES_PAGE_SIZE = 30;

export const chatApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [CHAT_ENDPOINTS.LIST_CONVERSATIONS]: builder.query<Conversation[], void>({
      query: () => API_ROUTES.CHAT_CONVERSATIONS,
      providesTags: [TAG_TYPES.CHAT],
    }),
    [CHAT_ENDPOINTS.CREATE_CONVERSATION]: builder.mutation<
      Conversation,
      { otherUserId: string }
    >({
      query: (body) => ({
        url: API_ROUTES.CHAT_CONVERSATIONS,
        method: "POST",
        body,
      }),
      invalidatesTags: [TAG_TYPES.CHAT],
    }),
    // Messages du plus récent au plus ancien ; les pages suivantes (cursor)
    // sont ajoutées à la fin du cache.
    [CHAT_ENDPOINTS.GET_MESSAGES]: builder.query<Message[], MessagesArg>({
      query: ({ conversationId, cursor }) => ({
        url: API_ROUTES.chatMessages(conversationId),
        params: { limit: MESSAGES_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
      }),
      serializeQueryArgs: ({ queryArgs }) => queryArgs.conversationId,
      merge: (current, incoming, { arg }) => {
        if (!arg.cursor) {
          current.splice(0, current.length, ...incoming);
          return;
        }
        const known = new Set(current.map((m) => m.id));
        current.push(...incoming.filter((m) => !known.has(m.id)));
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.cursor !== previousArg?.cursor,
    }),
    [CHAT_ENDPOINTS.SEND_MESSAGE]: builder.mutation<
      Message,
      { conversationId: string; content: string }
    >({
      query: ({ conversationId, content }) => ({
        url: API_ROUTES.chatMessages(conversationId),
        method: "POST",
        body: { content },
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        applyMessageToCache(dispatch, data, { meId: data.senderId });
      },
    }),
    [CHAT_ENDPOINTS.MARK_READ]: builder.mutation<{ ok: true }, string>({
      query: (conversationId) => ({
        url: API_ROUTES.chatRead(conversationId),
        method: "POST",
      }),
      async onQueryStarted(conversationId, { dispatch }) {
        dispatch(
          chatApi.util.updateQueryData(
            CHAT_ENDPOINTS.LIST_CONVERSATIONS,
            undefined,
            (draft) => {
              const conversation = draft.find((c) => c.id === conversationId);
              if (conversation) conversation.unreadCount = 0;
            },
          ),
        );
      },
    }),
    [CHAT_ENDPOINTS.LIST_BLOCKED]: builder.query<User[], void>({
      query: () => API_ROUTES.CHAT_BLOCKS,
      providesTags: [TAG_TYPES.BLOCKS],
    }),
    [CHAT_ENDPOINTS.BLOCK_USER]: builder.mutation<{ ok: true }, string>({
      query: (userId) => ({
        url: API_ROUTES.chatBlock(userId),
        method: "POST",
      }),
      // bloquer supprime aussi l'amitié côté back
      invalidatesTags: [TAG_TYPES.BLOCKS, TAG_TYPES.FRIENDS, TAG_TYPES.USERS],
    }),
    [CHAT_ENDPOINTS.UNBLOCK_USER]: builder.mutation<{ ok: true }, string>({
      query: (userId) => ({
        url: API_ROUTES.chatBlock(userId),
        method: "DELETE",
      }),
      invalidatesTags: [TAG_TYPES.BLOCKS],
    }),
  }),
});

type Dispatch = (action: unknown) => unknown;

/** Insère un message (envoi ou websocket) dans les caches, sans doublon. */
export function applyMessageToCache(
  dispatch: Dispatch,
  message: Message,
  options: { meId?: string; activeConversationId?: string | null } = {},
) {
  const isUnread =
    message.senderId !== options.meId &&
    message.conversationId !== options.activeConversationId;

  dispatch(
    chatApi.util.updateQueryData(
      CHAT_ENDPOINTS.GET_MESSAGES,
      { conversationId: message.conversationId },
      (draft) => {
        if (!draft.some((m) => m.id === message.id)) draft.unshift(message);
      },
    ),
  );

  let known = false;
  dispatch(
    chatApi.util.updateQueryData(
      CHAT_ENDPOINTS.LIST_CONVERSATIONS,
      undefined,
      (draft) => {
        const index = draft.findIndex((c) => c.id === message.conversationId);
        if (index === -1) return;
        known = true;
        const [conversation] = draft.splice(index, 1);
        if (isUnread && conversation.lastMessage?.id !== message.id) {
          conversation.unreadCount += 1;
        }
        conversation.lastMessage = message;
        conversation.updatedAt = message.createdAt;
        draft.unshift(conversation);
      },
    ),
  );
  if (!known) {
    dispatch(chatApi.util.invalidateTags([TAG_TYPES.CHAT]));
  }
}

/** Met à jour la date de dernière lecture du pair (double check en temps réel). */
export function applyConversationReadToCache(
  dispatch: Dispatch,
  payload: { conversationId: string; readerId: string; readAt: string },
  meId?: string,
) {
  if (payload.readerId === meId) return;
  dispatch(
    chatApi.util.updateQueryData(
      CHAT_ENDPOINTS.LIST_CONVERSATIONS,
      undefined,
      (draft) => {
        const conversation = draft.find((c) => c.id === payload.conversationId);
        if (conversation) conversation.peerLastReadAt = payload.readAt;
      },
    ),
  );
}

export const {
  useListConversationsQuery,
  useCreateConversationMutation,
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkConversationReadMutation,
  useListBlockedQuery,
  useBlockUserMutation,
  useUnblockUserMutation,
} = chatApi;
