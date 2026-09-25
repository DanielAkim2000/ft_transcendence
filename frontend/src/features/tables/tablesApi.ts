import { api } from "@/store/api";
import { TAG_TYPES } from "@/constants/tagTypes";
import { API_ROUTES } from "@/constants/apiRoutes";
import { TABLES_ENDPOINTS } from "@/constants/queryEndpoints";

export type TableStatus = "FREE" | "BUSY";

export interface TableOccupant {
  id: string;
  displayname: string;
  avatarUrl: string | null;
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
  occupiedAt: string | null;
  occupiedBy: TableOccupant | null;
  currentTournamentTie: TableTournamentTie | null;
}

export const tablesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [TABLES_ENDPOINTS.LIST_TABLES]: builder.query<BabyTable[], void>({
      query: () => API_ROUTES.TABLES,
      providesTags: [TAG_TYPES.TABLES],
    }),
    [TABLES_ENDPOINTS.OCCUPY_TABLE]: builder.mutation<BabyTable, string>({
      query: (tableId) => ({
        url: API_ROUTES.tableOccupy(tableId),
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
    [TABLES_ENDPOINTS.RELEASE_TABLE]: builder.mutation<BabyTable, string>({
      query: (tableId) => ({
        url: API_ROUTES.tableRelease(tableId),
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

export const {
  useListTablesQuery,
  useOccupyTableMutation,
  useReleaseTableMutation,
} = tablesApi;
