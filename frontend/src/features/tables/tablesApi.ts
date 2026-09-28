import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { TABLES_ENDPOINTS } from "@/constants/queryEndpoints";
import type { MatchFormat } from "@/features/matches/matchesApi";

export type TableStatus = "FREE" | "BUSY";

export interface TablePlayer {
  id: string;
  displayname: string;
  avatarUrl: string | null;
}

/** Un groupe (1 joueur en 1v1, 2 en 2v2) installé sur un côté de la table. */
export interface TableGroup {
  id: string;
  slot: number;
  players: TablePlayer[];
}

export interface TableTournamentTie {
  id: string;
  tournamentId: string;
  tournamentName: string;
  round: number;
  roundLabel: string;
  entryALabel: string;
  entryBLabel: string;
}

export interface BabyTable {
  id: string;
  name: string;
  status: TableStatus;
  format: MatchFormat | null;
  occupiedAt: string | null;
  groups: TableGroup[];
  currentMatchId: string | null;
  releaseVoterIds: string[];
  endRequestedAt: string | null;
  currentTournamentTie: TableTournamentTie | null;
}

export const tablesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [TABLES_ENDPOINTS.LIST_TABLES]: builder.query<BabyTable[], void>({
      query: () => API_ROUTES.TABLES,
      providesTags: [TAG_TYPES.TABLES],
    }),
    [TABLES_ENDPOINTS.VOTE_RELEASE_TABLE]: builder.mutation<BabyTable, string>({
      query: (tableId) => ({
        url: API_ROUTES.queueReleaseVote(tableId),
        method: "POST",
      }),
      async onQueryStarted(_id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          applyTableToCache(dispatch, data);
        } catch {
          // 409 : la liste sera mise à jour par le websocket
        }
      },
    }),
  }),
});

type Dispatch = (action: unknown) => unknown;

/** Remplace / insère une table dans le cache (réponse HTTP ou websocket). */
export function applyTableToCache(dispatch: Dispatch, table: BabyTable) {
  dispatch(
    tablesApi.util.updateQueryData(
      TABLES_ENDPOINTS.LIST_TABLES,
      undefined,
      (draft) => {
        const index = draft.findIndex((entry) => entry.id === table.id);
        if (index === -1) draft.push(table);
        else draft[index] = table;
        draft.sort((a, b) => a.name.localeCompare(b.name));
      },
    ),
  );
}

export const { useListTablesQuery, useVoteReleaseTableMutation } = tablesApi;
