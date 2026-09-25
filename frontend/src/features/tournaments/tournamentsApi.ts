import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { TOURNAMENTS_ENDPOINTS } from "@/constants/queryEndpoints";
import type { MatchFormat, MatchStatus } from "@/features/matches/matchesApi";

export type TournamentStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
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
  legsPlayed: number;
  legsNeeded: number;
  aggregateScoreA: number | null;
  aggregateScoreB: number | null;
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
    [TOURNAMENTS_ENDPOINTS.LIST_TOURNAMENTS]: builder.query<Tournament[], void>({
      query: () => API_ROUTES.TOURNAMENTS,
      providesTags: [TAG_TYPES.TOURNAMENTS],
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

/** Remplace un tournoi dans les deux caches (liste + détail) — réponse websocket. */
export function applyTournamentToCache(dispatch: Dispatch, tournament: Tournament) {
  dispatch(
    tournamentsApi.util.updateQueryData(
      TOURNAMENTS_ENDPOINTS.LIST_TOURNAMENTS,
      undefined,
      (draft) => {
        const index = draft.findIndex((entry) => entry.id === tournament.id);
        if (index === -1) draft.unshift(tournament);
        else draft[index] = tournament;
      },
    ),
  );
  dispatch(
    tournamentsApi.util.updateQueryData(
      TOURNAMENTS_ENDPOINTS.GET_TOURNAMENT,
      tournament.id,
      () => tournament,
    ),
  );
  dispatch(tournamentsApi.util.invalidateTags([TAG_TYPES.TABLES, TAG_TYPES.QUEUE]));
}

export const {
  useListTournamentsQuery,
  useGetTournamentQuery,
  useCreateTournamentMutation,
  useAddTournamentEntryMutation,
  useRemoveTournamentEntryMutation,
  useLaunchTournamentMutation,
  useCancelTournamentMutation,
} = tournamentsApi;
