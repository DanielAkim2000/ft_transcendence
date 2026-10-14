import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { LegalLinks } from "@/components/legal-links";
import { ROUTES } from "@/constants/routes";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils";
import {
  useGetHealthQuery,
  type HealthReport,
} from "@/features/health/healthApi";

const POLL_INTERVAL_MS = 15_000;

type Tone = "ok" | "warn" | "bad";

const toneClass: Record<Tone, string> = {
  ok: "text-primary",
  warn: "text-yellow-500",
  bad: "text-destructive",
};

/** [Minor · Health check et sauvegardes] 3661 -> « 1 h 1 min » ; en dessous d'une minute, en secondes. */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} j ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${seconds} s`;
}

/** [Minor · Health check et sauvegardes] Formate une taille en octets (KB ou MB) pour la sauvegarde. */
function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** [Minor · Health check et sauvegardes] Ligne d'un service (base, sauvegarde…) avec son état coloré et ses détails. */
function ServiceRow({
  name,
  state,
  tone,
  details,
}: {
  name: string;
  state: string;
  tone: Tone;
  details: string[];
}) {
  return (
    <li className="flex flex-col gap-1 border border-border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{name}</span>
        <span
          className={cn(
            "text-xs font-bold uppercase tracking-wider",
            toneClass[tone],
          )}
        >
          ● {state}
        </span>
      </div>
      {details.map((line) => (
        <p key={line} className="text-xs text-muted-foreground">
          {line}
        </p>
      ))}
    </li>
  );
}

function isHealthReport(value: unknown): value is HealthReport {
  const checks = (value as Partial<HealthReport> | null | undefined)?.checks;
  return Boolean(checks?.api && checks.database && checks.backups);
}

/** [Minor · Health check et sauvegardes] Page publique /status : interroge GET /health toutes les 15 s et affiche l'état de l'API, de la base et des sauvegardes. */
export const Status = () => {
  const { t, i18n } = useTranslation();
  const isLoggedIn = useAppSelector((s) => Boolean(s.auth.accessToken));
  const { data, error } = useGetHealthQuery(undefined, {
    pollingInterval: POLL_INTERVAL_MS,
  });
  // Le backend répond 503 avec le rapport quand la base est en panne.
  // Si le backend est coupé, le proxy renvoie un corps qui n'est pas un rapport : on le valide.
  const candidate =
    data ?? (error as { data?: Partial<HealthReport> } | undefined)?.data;
  const report = isHealthReport(candidate) ? candidate : undefined;
  const unreachable = !report && error !== undefined;

  const overall = unreachable ? "unreachable" : (report?.status ?? null);
  const overallTone: Tone =
    overall === "ok" ? "ok" : overall === "degraded" ? "warn" : "bad";

  const backups = report?.checks.backups;
  const backupDetails = backups
    ? backups.lastBackupAt
      ? [
          t("status.backupCount", { count: backups.count }),
          t("status.lastBackup", {
            date: new Date(backups.lastBackupAt).toLocaleString(i18n.language),
            size: formatSize(backups.lastBackupSizeBytes ?? 0),
          }),
        ]
      : [t("status.noBackup")]
    : [];

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <Link
        to={isLoggedIn ? ROUTES.HOME : ROUTES.LOGIN}
        className="w-fit text-xs text-muted-foreground hover:text-primary"
      >
        {t("status.back")}
      </Link>
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          {t("status.label")}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {t("status.title")}
        </h1>
      </header>

      <div
        role="status"
        className={cn(
          "border border-border p-4 text-sm font-bold",
          toneClass[overallTone],
        )}
      >
        {overall ? `● ${t(`status.overall.${overall}`)}` : "…"}
      </div>

      {report ? (
        <ul className="flex flex-col gap-2">
          <ServiceRow
            name={t("status.services.api")}
            state={t(`status.state.${report.checks.api.status}`)}
            tone={report.checks.api.status === "ok" ? "ok" : "bad"}
            details={[
              t("status.uptime", { value: formatUptime(report.uptimeSeconds) }),
            ]}
          />
          <ServiceRow
            name={t("status.services.database")}
            state={t(`status.state.${report.checks.database.status}`)}
            tone={report.checks.database.status === "ok" ? "ok" : "bad"}
            details={
              report.checks.database.latencyMs !== null
                ? [
                    t("status.latency", {
                      ms: report.checks.database.latencyMs,
                    }),
                  ]
                : []
            }
          />
          <ServiceRow
            name={t("status.services.backups")}
            state={t(`status.state.${report.checks.backups.status}`)}
            tone={report.checks.backups.status === "ok" ? "ok" : "warn"}
            details={backupDetails}
          />
        </ul>
      ) : null}

      {report ? (
        <p className="text-[11px] text-muted-foreground">
          {t("status.refreshed", {
            time: new Date(report.timestamp).toLocaleTimeString(i18n.language),
          })}
        </p>
      ) : null}

      <footer className="mt-auto">
        <LegalLinks />
      </footer>
    </div>
  );
};
