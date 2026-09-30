import { api } from "@/store/api";
import { API_ROUTES } from "@/constants/apiRoutes";
import { GDPR_ENDPOINTS } from "@/constants/queryEndpoints";

export type ExportFormat = "csv" | "json";

export const gdprApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Déclenché par un clic (téléchargement), donc une mutation. Le fichier (JSON ou CSV)
    // est construit par le backend : on le récupère tel quel, en texte.
    [GDPR_ENDPOINTS.EXPORT_DATA]: builder.mutation<string, ExportFormat>({
      query: (format) => ({
        url: API_ROUTES.GDPR_EXPORT,
        method: "GET",
        params: { format },
        responseHandler: "text",
      }),
    }),
    [GDPR_ENDPOINTS.REQUEST_DELETION]: builder.mutation<
      { message: string },
      void
    >({
      query: () => ({ url: API_ROUTES.GDPR_DELETION_REQUEST, method: "POST" }),
    }),
    [GDPR_ENDPOINTS.CONFIRM_DELETION]: builder.mutation<
      { message: string },
      string
    >({
      query: (token) => ({
        url: API_ROUTES.GDPR_DELETION_CONFIRM,
        method: "POST",
        body: { token },
      }),
    }),
  }),
});

export const {
  useExportMyDataMutation,
  useRequestAccountDeletionMutation,
  useConfirmAccountDeletionMutation,
} = gdprApi;
