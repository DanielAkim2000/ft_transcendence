import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { ADMIN_ENDPOINTS } from "@/constants/queryEndpoints";
import type { Role, Status } from "@/features/auth/authApi";
import type { PageArgs, Paginated } from "@/lib/pagination";

/** Utilisateur vu par l'administration (jamais de hash ni de secret). */
export interface AdminUser {
  id: string;
  login42: string | null;
  email: string;
  displayname: string;
  avatarUrl: string | null;
  role: Role;
  twoFactorEnabled: boolean;
  isOnline: boolean;
  status: Status;
  rating: number;
  matchesPlayed: number;
  wins: number;
  hasPassword: boolean;
  /** Ban en cours (null si non banni ; endTime null = permanent). */
  ban: { reason: string; startTime: string; endTime: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUsersArgs extends PageArgs {
  q?: string;
  /** true : uniquement les utilisateurs actuellement bannis. */
  banned?: boolean;
}

export interface CreateAdminUserRequest {
  email: string;
  displayname: string;
  password: string;
  role: Role;
}

export interface UpdateAdminUserRequest {
  id: string;
  email?: string;
  displayname?: string;
  role?: Role;
  password?: string;
}

export const adminApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [ADMIN_ENDPOINTS.LIST_USERS]: builder.query<
      Paginated<AdminUser>,
      AdminUsersArgs | void
    >({
      query: (args) => {
        const params: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(args ?? {})) {
          if (value !== undefined && value !== "" && value !== false)
            params[key] = value;
        }
        return { url: API_ROUTES.ADMIN_USERS, params };
      },
      providesTags: [{ type: TAG_TYPES.USERS, id: "ADMIN_LIST" }],
    }),
    [ADMIN_ENDPOINTS.CREATE_USER]: builder.mutation<
      AdminUser,
      CreateAdminUserRequest
    >({
      query: (body) => ({ url: API_ROUTES.ADMIN_USERS, method: "POST", body }),
      invalidatesTags: [TAG_TYPES.USERS],
    }),
    [ADMIN_ENDPOINTS.UPDATE_USER]: builder.mutation<
      AdminUser,
      UpdateAdminUserRequest
    >({
      query: ({ id, ...body }) => ({
        url: API_ROUTES.adminUser(id),
        method: "PATCH",
        body,
      }),
      // AUTH : un admin qui modifie son propre compte doit voir son profil à jour.
      invalidatesTags: [TAG_TYPES.USERS, TAG_TYPES.AUTH, TAG_TYPES.RANKING],
    }),
    [ADMIN_ENDPOINTS.DELETE_USER]: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: API_ROUTES.adminUser(id), method: "DELETE" }),
      invalidatesTags: [TAG_TYPES.USERS, TAG_TYPES.RANKING],
    }),
  }),
});

export const {
  useAdminListUsersQuery,
  useAdminCreateUserMutation,
  useAdminUpdateUserMutation,
  useAdminDeleteUserMutation,
} = adminApi;
