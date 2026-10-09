import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { TOURNAMENTS_ENDPOINTS } from "@/constants/queryEndpoints";
import type { MatchFormat, MatchStatus } from "@/features/matches/matchesApi";
import type { PageArgs, Paginated } from "@/lib/pagination";

export type TournamentStatus = "DRAFT" | "QUEUED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TournamentTieStatus = "PENDING" | "READY" | "IN_PROGRESS" | "DONE";

export interface TournamentPlayer {
  id: string;
  displayname: string;
  avatarUrl: string | null;
  rating: number;
}

export interface TournamentEntry {
  id: string;
  seed: number;
  player1: TournamentPlayer;
  player2: TournamentPlayer | null;
  eliminatedRound: number | null;
}

export interface TournamentTie {
  id: string;
  round: number;
  slot: number;
  roundLabel: string;
  entryA: TournamentEntry | null;
  entryB: TournamentEntry | null;
  status: TournamentTieStatus;
  winnerEntryId: string | null;
  pointsAwarded: number | null;
  activeTableId: string | null;
  activeLegId: string | null;
  activeLegStatus: MatchStatus | null;
  /** Score soumis de la manche à valider (null sinon). */
  activeLegScoreA: number | null;
  activeLegScoreB: number | null;
  /** Joueur qui a soumis ce score : seule l'équipe adverse peut le valider. */
  activeLegSubmittedById: string | null;
  legsPlayed: number;
  legsNeeded: number;
  aggregateScoreA: number | null;
  aggregateScoreB: number | null;
  /** Manches terminées (corrigeables par un admin). */
  completedLegs: { id: string; legNumber: number; scoreA: number; scoreB: number }[];
}

export interface Tournament {
  id: string;
  name: string;
  format: MatchFormat;
  twoLegged: boolean;
  status: TournamentStatus;
  totalRounds: number | null;
  createdBy: TournamentPlayer;
  entries: TournamentEntry[];
  ties: TournamentTie[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  championEntryId: string | null;
}

export const tournamentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [TOURNAMENTS_ENDPOINTS.LIST_TOURNAMENTS]: builder.query<
      Paginated<Tournament>,
      PageArgs | void
    >({
      query: (args) => ({ url: API_ROUTES.TOURNAMENTS, params: args ?? undefined }),
      providesTags: [{ type: TAG_TYPES.TOURNAMENTS, id: "LIST" }],
    }),
    // Nombre de manches à jouer ou valider (pastille de la barre latérale).
    [TOURNAMENTS_ENDPOINTS.COUNT_TOURNAMENT_ACTIONS]: builder.query<{ count: number }, void>({
      query: () => API_ROUTES.TOURNAMENTS_PENDING_ACTIONS,
      providesTags: [{ type: TAG_TYPES.TOURNAMENTS, id: "LIST" }],
    }),
    [TOURNAMENTS_ENDPOINTS.GET_TOURNAMENT]: builder.query<Tournament, string>({
      query: (id) => API_ROUTES.tournament(id),
      providesTags: [TAG_TYPES.TOURNAMENTS],
    }),
    [TOURNAMENTS_ENDPOINTS.CREATE_TOURNAMENT]: builder.mutation<
      Tournament,
      {
        name: string;
        format: MatchFormat;
        twoLegged: boolean;
        entries: { player1Id: string; player2Id?: string }[];
      }
    >({
      query: (body) => ({ url: API_ROUTES.TOURNAMENTS, method: "POST", body }),
      invalidatesTags: [TAG_TYPES.TOURNAMENTS],
    }),
    [TOURNAMENTS_ENDPOINTS.ADD_ENTRY]: builder.mutation<
      Tournament,
      { id: string; player1Id: string; player2Id?: string }
    >({
      query: ({ id, ...body }) => ({
        url: API_ROUTES.tournamentEntries(id),
        method: "POST",
        body,
      }),
      invalidatesTags: [TAG_TYPES.TOURNAMENTS],
    }),
    [TOURNAMENTS_ENDPOINTS.REMOVE_ENTRY]: builder.mutation<
      Tournament,
      { id: string; entryId: string }
    >({
      query: ({ id, entryId }) => ({
        url: API_ROUTES.tournamentEntry(id, entryId),
        method: "DELETE",
      }),
      invalidatesTags: [TAG_TYPES.TOURNAMENTS],
    }),
    [TOURNAMENTS_ENDPOINTS.REPLACE_PLAYER]: builder.mutation<
      Tournament,
      { id: string; entryId: string; playerId: string; replacementId: string }
    >({
      query: ({ id, entryId, ...body }) => ({
        url: API_ROUTES.tournamentEntryPlayer(id, entryId),
        method: "PATCH",
        body,
      }),
      invalidatesTags: [TAG_TYPES.TOURNAMENTS, TAG_TYPES.MATCHES],
    }),
    [TOURNAMENTS_ENDPOINTS.LAUNCH_TOURNAMENT]: builder.mutation<Tournament, string>({
      query: (id) => ({ url: API_ROUTES.tournamentLaunch(id), method: "POST" }),
      invalidatesTags: [TAG_TYPES.TOURNAMENTS, TAG_TYPES.TABLES, TAG_TYPES.QUEUE],
    }),
    [TOURNAMENTS_ENDPOINTS.CANCEL_TOURNAMENT]: builder.mutation<Tournament, string>({
      query: (id) => ({ url: API_ROUTES.tournamentCancel(id), method: "POST" }),
      invalidatesTags: [TAG_TYPES.TOURNAMENTS, TAG_TYPES.TABLES],
    }),
  }),
});

type Dispatch = (action: unknown) => unknown;

/** Un tournoi a changé (websocket) : on met à jour son détail dans le cache et on recharge les listes, paginées côté backend. */
export function applyTournamentToCache(dispatch: Dispatch, tournament: Tournament) {
  dispatch(
    tournamentsApi.util.updateQueryData(
      TOURNAMENTS_ENDPOINTS.GET_TOURNAMENT,
      tournament.id,
      () => tournament,
    ),
  );
  dispatch(
    tournamentsApi.util.invalidateTags([{ type: TAG_TYPES.TOURNAMENTS, id: "LIST" }]),
  );
  // Une correction de score peut aussi changer les notes : le classement est rechargé.
  dispatch(
    tournamentsApi.util.invalidateTags([
      TAG_TYPES.TABLES,
      TAG_TYPES.QUEUE,
      TAG_TYPES.RANKING,
    ]),
  );
}

export const {
  useListTournamentsQuery,
  useCountTournamentActionsQuery,
  useGetTournamentQuery,
  useCreateTournamentMutation,
  useAddTournamentEntryMutation,
  useRemoveTournamentEntryMutation,
  useReplaceTournamentPlayerMutation,
  useLaunchTournamentMutation,
  useCancelTournamentMutation,
} = tournamentsApi;
