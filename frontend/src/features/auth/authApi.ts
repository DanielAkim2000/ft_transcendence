import { api } from "@/store/api";
import {
  clearCredentials,
  setAccessToken,
  setTwoFactorRequired,
} from "./authSlice";
import { logger } from "@/lib/logger";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { AUTH_ENDPOINTS } from "@/constants/queryEndpoints";
import type {
  AccentPreference,
  LanguagePreference,
  RadiusPreference,
  ThemePreference,
} from "../settings/settingsSlice";

interface LoginRequest {
  email: string;
  password: string;
}

export type Status = "ONLINE" | "OFFLINE" | "IN_GAME";

export type Role = "ADMIN" | "USER";

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
  theme: ThemePreference;
  language: LanguagePreference;
  accent: AccentPreference;
  radius: RadiusPreference;
  createdAt: Date;
  updatedAt: Date;
}

interface LoginResponseWithoutPreAuthToken {
  accessToken: string;
  twoFactorEnabled: false;
  user: User;
}

interface LoginResponseWithTwoFactor {
  twoFactorEnabled: true;
}

interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  password: string;
}

interface Verify2faRequest {
  code: string;
}

interface Toggle2faRequest {
  code?: string;
  /** Désactivation uniquement : code de secours si l'appli d'authentification est perdue. */
  recoveryCode?: string;
}

interface Toggle2faResponse {
  enabled: boolean;
  /** Présent uniquement à l'activation : seule fois où les codes sont visibles. */
  recoveryCodes: string[] | null;
}

interface UseRecoveryCodeRequest {
  recoveryCode: string;
}

interface RegenerateRecoveryCodesRequest {
  code?: string;
  password?: string;
}

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [AUTH_ENDPOINTS.REGISTER]: builder.mutation<
      { user: User; accessToken: string },
      RegisterRequest
    >({
      query: (body) => ({
        url: API_ROUTES.AUTH_REGISTER,
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
      invalidatesTags: [TAG_TYPES.AUTH],
    }),
    [AUTH_ENDPOINTS.LOGIN]: builder.mutation<
      LoginResponseWithoutPreAuthToken | LoginResponseWithTwoFactor,
      LoginRequest
    >({
      query: (body) => ({
        url: API_ROUTES.AUTH_LOGIN,
        method: "POST",
        body,
      }),
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.twoFactorEnabled) {
            dispatch(setTwoFactorRequired());
          } else if (data.twoFactorEnabled === false) {
            dispatch(setAccessToken({ accessToken: data.accessToken }));
          }
        } catch (error) {
          logger(error, "error");
        }
      },
      invalidatesTags: (result) =>
        result && result.twoFactorEnabled === false ? [TAG_TYPES.AUTH] : [],
    }),
    [AUTH_ENDPOINTS.REFRESH]: builder.mutation<{ accessToken: string }, void>({
      query: () => ({
        url: API_ROUTES.AUTH_REFRESH,
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
    [AUTH_ENDPOINTS.LOGOUT]: builder.mutation<void, void>({
      query: () => ({
        url: API_ROUTES.AUTH_LOGOUT,
        method: "POST",
      }),
      invalidatesTags: [TAG_TYPES.AUTH],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch (error) {
          logger(error, "error");
        } finally {
          dispatch(clearCredentials());
          dispatch(api.util.resetApiState());
        }
      },
    }),
    [AUTH_ENDPOINTS.FORGOT_PASSWORD]: builder.mutation<
      { message: string },
      ForgotPasswordRequest
    >({
      query: (body) => ({
        url: API_ROUTES.AUTH_FORGOT_PASSWORD,
        method: "POST",
        body,
      }),
    }),
    [AUTH_ENDPOINTS.RESET_PASSWORD]: builder.mutation<
      { message: string },
      ResetPasswordRequest
    >({
      query: (body) => ({
        url: API_ROUTES.AUTH_RESET_PASSWORD,
        method: "POST",
        body,
      }),
    }),
    [AUTH_ENDPOINTS.ME]: builder.query<User, void>({
      query: () => ({
        url: API_ROUTES.AUTH_ME,
        method: "GET",
      }),
      providesTags: [TAG_TYPES.AUTH],
    }),
    [AUTH_ENDPOINTS.CHECK_2FA_PENDING]: builder.query<{ pending: true }, void>({
      query: () => ({
        url: API_ROUTES.AUTH_2FA_PENDING,
        method: "GET",
      }),
    }),
    [AUTH_ENDPOINTS.VERIFY_2FA]: builder.mutation<
      { user: User; accessToken: string },
      Verify2faRequest
    >({
      query: (body) => ({
        url: API_ROUTES.AUTH_2FA_VERIFY,
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
      invalidatesTags: [TAG_TYPES.AUTH],
    }),
    [AUTH_ENDPOINTS.SETUP_2FA]: builder.mutation<
      { secret: string; otpauthUrl: string },
      void
    >({
      query: () => ({
        url: API_ROUTES.AUTH_2FA_SETUP,
        method: "POST",
      }),
    }),
    [AUTH_ENDPOINTS.TOGGLE_2FA]: builder.mutation<Toggle2faResponse, Toggle2faRequest>({
      query: (body) => ({
        url: API_ROUTES.AUTH_2FA_TOGGLE,
        method: "POST",
        body,
      }),
      invalidatesTags: [TAG_TYPES.AUTH],
    }),
    [AUTH_ENDPOINTS.USE_RECOVERY_CODE]: builder.mutation<
      { user: User; accessToken: string; remainingRecoveryCodes: number },
      UseRecoveryCodeRequest
    >({
      query: (body) => ({
        url: API_ROUTES.AUTH_2FA_USE_RECOVERY_CODE,
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
      invalidatesTags: [TAG_TYPES.AUTH],
    }),
    [AUTH_ENDPOINTS.GET_RECOVERY_CODES_STATUS]: builder.query<
      { remaining: number },
      void
    >({
      query: () => ({
        url: API_ROUTES.AUTH_2FA_RECOVERY_CODES,
        method: "GET",
      }),
      providesTags: [TAG_TYPES.AUTH],
    }),
    [AUTH_ENDPOINTS.REGENERATE_RECOVERY_CODES]: builder.mutation<
      { recoveryCodes: string[] },
      RegenerateRecoveryCodesRequest
    >({
      query: (body) => ({
        url: API_ROUTES.AUTH_2FA_RECOVERY_CODES_REGENERATE,
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
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useMeQuery,
  useLazyCheck2faPendingQuery,
  useVerify2faMutation,
  useSetup2faMutation,
  useToggle2faMutation,
  useUseRecoveryCodeMutation,
  useGetRecoveryCodesStatusQuery,
  useRegenerateRecoveryCodesMutation,
} = authApi;
