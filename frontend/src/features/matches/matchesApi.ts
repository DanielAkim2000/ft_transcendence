import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { MATCHES_ENDPOINTS } from "@/constants/queryEndpoints";
import type { PageArgs, Paginated } from "@/lib/pagination";

export type MatchFormat = "ONE_V_ONE" | "TWO_V_TWO";
export type MatchStatus =
  | "PENDING"
  | "DECLINED"
  | "ACCEPTED"
  | "PENDING_VALIDATION"
  | "COMPLETED"
  | "DISPUTED";

export interface MatchPlayer {
  id: string;
  displayname: string;
  avatarUrl: string | null;
  rating: number;
}

export interface Match {
  id: string;
  format: MatchFormat;
  status: MatchStatus;
  teamA: MatchPlayer[];
  teamB: MatchPlayer[];
  scoreA: number | null;
  scoreB: number | null;
  submittedBy: MatchPlayer | null;
  validatedBy: MatchPlayer | null;
  createdAt: string;
  respondedAt: string | null;
  submittedAt: string | null;
  validationExpiresAt: string | null;
  tournamentTieId: string | null;
  legNumber: number | null;
  tournamentId: string | null;
  tournamentName: string | null;
  tournamentRound: number | null;
  tableId: string | null;
}

export const matchesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [MATCHES_ENDPOINTS.LIST_MATCHES]: builder.query<Paginated<Match>, PageArgs | void>({
      query: (args) => ({ url: API_ROUTES.MATCHES_ME, params: args ?? undefined }),
      providesTags: [TAG_TYPES.MATCHES],
    }),
    [MATCHES_ENDPOINTS.LIST_MATCH_HISTORY]: builder.query<Paginated<Match>, PageArgs | void>({
      query: (args) => ({ url: API_ROUTES.MATCHES_HISTORY, params: args ?? undefined }),
      providesTags: [TAG_TYPES.MATCHES],
    }),
    // Nombre de défis qui attendent une action (pastille de la barre latérale).
    [MATCHES_ENDPOINTS.COUNT_MATCH_ACTIONS]: builder.query<{ count: number }, void>({
      query: () => API_ROUTES.MATCHES_PENDING_ACTIONS,
      providesTags: [TAG_TYPES.MATCHES],
    }),
    [MATCHES_ENDPOINTS.PROPOSE_MATCH]: builder.mutation<
      Match,
      { opponentId: string; format: MatchFormat; teammateId?: string }
    >({
      query: (body) => ({ url: API_ROUTES.MATCHES, method: "POST", body }),
      invalidatesTags: [TAG_TYPES.MATCHES],
    }),
    [MATCHES_ENDPOINTS.RESPOND_MATCH]: builder.mutation<
      Match,
      { matchId: string; accept: boolean; teammateId?: string }
    >({
      query: ({ matchId, ...body }) => ({
        url: API_ROUTES.matchRespond(matchId),
        method: "POST",
        body,
      }),
      invalidatesTags: [TAG_TYPES.MATCHES],
    }),
    [MATCHES_ENDPOINTS.SUBMIT_SCORE]: builder.mutation<
      Match,
      { matchId: string; scoreA: number; scoreB: number }
    >({
      query: ({ matchId, ...body }) => ({
        url: API_ROUTES.matchScore(matchId),
        method: "POST",
        body,
      }),
      invalidatesTags: [TAG_TYPES.MATCHES],
    }),
    [MATCHES_ENDPOINTS.VALIDATE_SCORE]: builder.mutation<
      Match,
      { matchId: string; accept: boolean }
    >({
      query: ({ matchId, accept }) => ({
        url: API_ROUTES.matchValidate(matchId),
        method: "POST",
        body: { accept },
      }),
      invalidatesTags: [TAG_TYPES.MATCHES, TAG_TYPES.RANKING],
    }),
  }),
});

type Dispatch = (action: unknown) => unknown;

/** Un match a changé (websocket) : les listes sont paginées côté backend, on les recharge au lieu de les patcher. */
export function applyMatchToCache(dispatch: Dispatch, match: Match) {
  dispatch(matchesApi.util.invalidateTags([TAG_TYPES.MATCHES]));
  if (match.status === "COMPLETED") {
    dispatch(matchesApi.util.invalidateTags([TAG_TYPES.RANKING]));
  }
}

export const {
  useListMatchesQuery,
  useListMatchHistoryQuery,
  useCountMatchActionsQuery,
  useProposeMatchMutation,
  useRespondMatchMutation,
  useSubmitScoreMutation,
  useValidateScoreMutation,
} = matchesApi;
