import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { AUTH_ENDPOINTS, USERS_ENDPOINTS } from "@/constants/queryEndpoints";
import { authApi, type User } from "@/features/auth/authApi";
import type { PageArgs, Paginated } from "@/lib/pagination";
import type {
  LanguagePreference,
  ThemePreference,
} from "../settings/settingsSlice";

export type FriendshipStatus =
  | "none"
  | "pending_out"
  | "pending_in"
  | "friends"
  | "self";

/** Relation d'amitié annotée par le backend sur chaque résultat de recherche. */
export type SearchFriendshipStatus =
  | "none"
  | "pending_out"
  | "pending_in"
  | "friends";

export type UserSearchResult = User & { friendshipStatus: SearchFriendshipStatus };

export interface SearchUsersArgs extends PageArgs {
  q?: string;
}

export interface ListFriendsArgs extends PageArgs {
  q?: string;
  online?: boolean;
}

/** Retire les paramètres non définis pour ne pas les envoyer dans l'URL. */
function toParams(args: object | void): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(args ?? {})) {
    if (value !== undefined && value !== "") params[key] = value as string | number | boolean;
  }
  return params;
}

export interface RankingEntry {
  id: string;
  displayname: string;
  avatarUrl: string | null;
  rating: number;
  matchesPlayed: number;
}

export const usersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [USERS_ENDPOINTS.SEARCH_USERS]: builder.query<
      Paginated<UserSearchResult>,
      SearchUsersArgs | void
    >({
      query: (args) => ({
        url: API_ROUTES.USERS,
        params: toParams(args),
      }),
      providesTags: [TAG_TYPES.USERS],
    }),
    [USERS_ENDPOINTS.GET_RANKING]: builder.query<RankingEntry[], void>({
      query: () => API_ROUTES.USERS_RANKING,
      providesTags: [TAG_TYPES.RANKING],
    }),
    [USERS_ENDPOINTS.GET_USER]: builder.query<
      { user: User; friendshipStatus: FriendshipStatus },
      string
    >({
      query: (id) => API_ROUTES.user(id),
      providesTags: (_result, _error, id) => [
        { type: TAG_TYPES.USERS, id },
        TAG_TYPES.FRIENDS,
      ],
    }),
    [USERS_ENDPOINTS.UPDATE_PROFILE]: builder.mutation<
      User,
      { displayname: string }
    >({
      query: (body) => ({
        url: API_ROUTES.USERS_ME,
        method: "PATCH",
        body,
      }),
      invalidatesTags: [TAG_TYPES.AUTH, TAG_TYPES.USERS],
    }),
    [USERS_ENDPOINTS.UPDATE_SETTINGS]: builder.mutation<
      User,
      { theme: ThemePreference; language: LanguagePreference }
    >({
      query: (body) => ({
        url: API_ROUTES.USERS_ME_SETTINGS,
        method: "PATCH",
        body,
      }),
      // Optimistic update du cache /auth/me :
      // sans ça, SettingsBootstrap peut réhydrater depuis un `me` encore
      // ancien pendant le PATCH et écraser le thème/langue qu'on vient de choisir.
      // Si la requête échoue, undo() restaure l'ancien cache.
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          authApi.util.updateQueryData(
            AUTH_ENDPOINTS.ME,
            undefined,
            (draft) => {
              draft.theme = arg.theme;
              draft.language = arg.language;
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
    [USERS_ENDPOINTS.UPLOAD_AVATAR]: builder.mutation<User, File>({
      query: (file) => {
        const body = new FormData();
        body.append("avatar", file);
        return {
          url: API_ROUTES.USERS_ME_AVATAR,
          method: "POST",
          body,
        };
      },
      invalidatesTags: [TAG_TYPES.AUTH, TAG_TYPES.USERS],
    }),
    // Amis, en ligne d'abord. Le tag "LIST" permet de rafraîchir uniquement ces
    // listes quand la présence d'un ami change (l'ordre dépend de son statut).
    [USERS_ENDPOINTS.LIST_FRIENDS]: builder.query<
      Paginated<User>,
      ListFriendsArgs | void
    >({
      query: (args) => ({
        url: API_ROUTES.USERS_ME_FRIENDS,
        params: toParams(args),
      }),
      providesTags: [{ type: TAG_TYPES.FRIENDS, id: "LIST" }],
    }),
    [USERS_ENDPOINTS.LIST_PENDING_FRIENDS]: builder.query<
      Paginated<User>,
      PageArgs | void
    >({
      query: (args) => ({
        url: API_ROUTES.USERS_ME_FRIENDS_PENDING,
        params: toParams(args),
      }),
      providesTags: [TAG_TYPES.FRIENDS],
    }),
    [USERS_ENDPOINTS.LIST_OUTGOING_FRIENDS]: builder.query<
      Paginated<User>,
      PageArgs | void
    >({
      query: (args) => ({
        url: API_ROUTES.USERS_ME_FRIENDS_OUTGOING,
        params: toParams(args),
      }),
      providesTags: [TAG_TYPES.FRIENDS],
    }),
    [USERS_ENDPOINTS.SEND_FRIEND_REQUEST]: builder.mutation<User, string>({
      query: (userId) => ({
        url: API_ROUTES.friend(userId),
        method: "POST",
      }),
      invalidatesTags: [TAG_TYPES.FRIENDS, TAG_TYPES.USERS],
    }),
    [USERS_ENDPOINTS.ACCEPT_FRIEND_REQUEST]: builder.mutation<User, string>({
      query: (userId) => ({
        url: API_ROUTES.friendAccept(userId),
        method: "PATCH",
      }),
      invalidatesTags: [TAG_TYPES.FRIENDS, TAG_TYPES.USERS],
    }),
    [USERS_ENDPOINTS.REMOVE_FRIEND]: builder.mutation<{ ok: true }, string>({
      query: (userId) => ({
        url: API_ROUTES.friend(userId),
        method: "DELETE",
      }),
      invalidatesTags: [TAG_TYPES.FRIENDS, TAG_TYPES.USERS],
    }),
  }),
});

export const {
  useSearchUsersQuery,
  useGetRankingQuery,
  useGetUserQuery,
  useUpdateProfileMutation,
  useUpdateSettingsMutation,
  useUploadAvatarMutation,
  useListFriendsQuery,
  useListPendingFriendsQuery,
  useListOutgoingFriendsQuery,
  useSendFriendRequestMutation,
  useAcceptFriendRequestMutation,
  useRemoveFriendMutation,
} = usersApi;
