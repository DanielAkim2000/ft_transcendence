import { api } from "@/store/api";
import { API_ROUTES } from "@/constants/apiRoutes";
import { HEALTH_ENDPOINTS } from "@/constants/queryEndpoints";

export type OverallStatus = "ok" | "degraded" | "down";

export interface HealthReport {
  status: OverallStatus;
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    api: { status: "ok" | "down" };
    database: { status: "ok" | "down"; latencyMs: number | null };
    backups: {
      status: "ok" | "stale" | "none";
      count: number;
      lastBackupAt: string | null;
      lastBackupSizeBytes: number | null;
      maxAgeHours: number;
    };
  };
}

/** [Minor · Health check et sauvegardes] Endpoints RTK Query du domaine « health » (requêtes/mutations typées, cache et invalidation par tags) : GET_HEALTH. */
export const healthApi = api.injectEndpoints({
  endpoints: (builder) => ({
    [HEALTH_ENDPOINTS.GET_HEALTH]: builder.query<HealthReport, void>({
      query: () => API_ROUTES.HEALTH,
    }),
  }),
});

export const { useGetHealthQuery } = healthApi;
