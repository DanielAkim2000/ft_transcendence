import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import type { User } from "@/features/auth/authApi";

export type FriendshipStatus =
  | "none"
  | "pending_out"
  | "pending_in"
  | "friends"
  | "self";

export const usersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    searchUsers: builder.query<User[], string | void>({
      query: (q) => ({
        url: "/users",
        params: q ? { q } : undefined,
      }),
      providesTags: [TAG_TYPES.USERS],
    }),
    getUser: builder.query<
      { user: User; friendshipStatus: FriendshipStatus },
      string
    >({
      query: (id) => `/users/${id}`,
      providesTags: (_result, _error, id) => [
        { type: TAG_TYPES.USERS, id },
        TAG_TYPES.FRIENDS,
      ],
    }),
    updateProfile: builder.mutation<User, { displayname: string }>({
      query: (body) => ({
        url: "/users/me",
        method: "PATCH",
        body,
      }),
      invalidatesTags: [TAG_TYPES.AUTH, TAG_TYPES.USERS],
    }),
    uploadAvatar: builder.mutation<User, File>({
      query: (file) => {
        const body = new FormData();
        body.append("avatar", file);
        return {
          url: "/users/me/avatar",
          method: "POST",
          body,
        };
      },
      invalidatesTags: [TAG_TYPES.AUTH, TAG_TYPES.USERS],
    }),
    listFriends: builder.query<User[], void>({
      query: () => "/users/me/friends",
      providesTags: [TAG_TYPES.FRIENDS],
    }),
    listPendingFriends: builder.query<User[], void>({
      query: () => "/users/me/friends/pending",
      providesTags: [TAG_TYPES.FRIENDS],
    }),
    sendFriendRequest: builder.mutation<User, string>({
      query: (userId) => ({
        url: `/users/me/friends/${userId}`,
        method: "POST",
      }),
      invalidatesTags: [TAG_TYPES.FRIENDS, TAG_TYPES.USERS],
    }),
    acceptFriendRequest: builder.mutation<User, string>({
      query: (userId) => ({
        url: `/users/me/friends/${userId}/accept`,
        method: "PATCH",
      }),
      invalidatesTags: [TAG_TYPES.FRIENDS, TAG_TYPES.USERS],
    }),
    removeFriend: builder.mutation<{ ok: true }, string>({
      query: (userId) => ({
        url: `/users/me/friends/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: [TAG_TYPES.FRIENDS, TAG_TYPES.USERS],
    }),
  }),
});

export const {
  useSearchUsersQuery,
  useGetUserQuery,
  useUpdateProfileMutation,
  useUploadAvatarMutation,
  useListFriendsQuery,
  useListPendingFriendsQuery,
  useSendFriendRequestMutation,
  useAcceptFriendRequestMutation,
  useRemoveFriendMutation,
} = usersApi;
