import { api } from "@/store/api";
import { clearCredentials, setAccessToken, setPreAuthToken } from "./authSlice";
import { logger } from "@/lib/logger";
import { TAG_TYPES } from "@/constants/tagTypes";

interface LoginRequest {
  email: string;
  password: string;
}

export enum Status {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
  IN_GAME = "IN_GAME",
}

export enum Role {
  ADMIN = "ADMIN",
  USER = "USER",
}

export interface User {
  id: string;
  login42: string | null;
  email: string;
  displayname: string;
  avatarUrl: string | null;
  twoFactorEnabled: boolean;
  isOnline: boolean;
  status: Status;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

interface LoginResponseWithoutPreAuthToken {
  accessToken: string;
  twoFactorEnabled: false;
  user: User;
}

interface LoginResponseWithPreAuthToken {
  twoFactorEnabled: true;
  preAuthToken: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

interface Verify2faRequest {
  code: string;
}

interface Toggle2faRequest {
  code: string;
}

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    register: builder.mutation<
      { user: User; accessToken: string },
      RegisterRequest
    >({
      query: (body) => ({
        url: "/auth/register",
        method: "POST",
        body,
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setAccessToken({ accessToken: data.accessToken }));
        } catch (error) {
          logger(error, "error");
        }
      },
    }),
    login: builder.mutation<
      LoginResponseWithoutPreAuthToken | LoginResponseWithPreAuthToken,
      LoginRequest
    >({
      query: (body) => ({
        url: "/auth/login",
        method: "POST",
        body,
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.twoFactorEnabled) {
            dispatch(setPreAuthToken({ preAuthToken: data.preAuthToken }));
          } else if (data.twoFactorEnabled === false) {
            dispatch(setAccessToken({ accessToken: data.accessToken }));
          }
        } catch (error) {
          logger(error, "error");
        }
      },
    }),
    refresh: builder.mutation<{ accessToken: string }, void>({
      query: () => ({
        url: "/auth/refresh",
        method: "POST",
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setAccessToken({ accessToken: data.accessToken }));
        } catch (error) {
          logger(error, "error");
        }
      },
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(clearCredentials());
        } catch (error) {
          logger(error, "error");
        }
      },
    }),
    me: builder.query<User, void>({
      query: () => ({
        url: "/auth/me",
        method: "GET",
      }),
      providesTags: [TAG_TYPES.AUTH],
    }),
    verify2fa: builder.mutation<
      { user: User; accessToken: string },
      Verify2faRequest
    >({
      query: (body) => ({
        url: "/auth/2fa/verify",
        method: "POST",
        body,
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setAccessToken({ accessToken: data.accessToken }));
        } catch (error) {
          logger(error, "error");
        }
      },
    }),
    setup2fa: builder.mutation<{ secret: string; otpauthUrl: string }, void>({
      query: () => ({
        url: "/auth/2fa/setup",
        method: "POST",
      }),
    }),
    toggle2fa: builder.mutation<boolean, Toggle2faRequest>({
      query: (body) => ({
        url: "/auth/2fa/toggle",
        method: "POST",
        body,
      }),
      invalidatesTags: [TAG_TYPES.AUTH],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useMeQuery,
  useVerify2faMutation,
  useSetup2faMutation,
  useToggle2faMutation,
} = authApi;
