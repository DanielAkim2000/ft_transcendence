import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useMeQuery } from "@/features/auth/authApi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "@/components/ui/toast";
import {
  useListTablesQuery,
  useOccupyTableMutation,
  useReleaseTableMutation,
  type BabyTable,
} from "@/features/tables/tablesApi";
import {
  useGetMyQueueEntryQuery,
  useJoinQueueMutation,
  useLeaveQueueMutation,
  useListQueueQuery,
  type QueueEntry,
} from "@/features/queue/queueApi";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatElapsed, formatRemaining, useNow } from "@/lib/elapsed";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { translateRoundLabel } from "@/features/tournaments/tournamentHelpers";

function QueueSection({
  table,
  now,
  meId,
  myEntry,
}: {
  table: BabyTable;
  now: number;
  meId?: string;
  myEntry: QueueEntry | null;
}) {
  const { t } = useTranslation();
  const { data: entries = [] } = useListQueueQuery(table.id);
  const [occupy, { isLoading: confirming }] = useOccupyTableMutation();
  const [join, { isLoading: joining }] = useJoinQueueMutation();
  const [leave, { isLoading: leaving }] = useLeaveQueueMutation();
  const isMine = table.status === "BUSY" && table.occupiedBy?.id === meId;
  const myEntryHere = myEntry?.tableId === table.id ? myEntry : null;
  const calledForMe = myEntryHere?.status === "CALLED";
  const queueable = table.status === "BUSY" || entries.length > 0;
  const canJoin = !myEntry && !isMine && queueable;

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("tables.actionFailed")),
        type: "error",
      });
    }
  };

  if (entries.length === 0 && !canJoin) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {t("queue.title")} · {entries.length}
      </h3>
      {entries.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={cn(
                "flex items-center justify-between gap-2 px-2 py-1 text-xs",
                entry.status === "CALLED" && "bg-primary/10 text-primary",
              )}
            >
              <span className="truncate">
                {entry.position}. {entry.requester.displayname}
              </span>
              {entry.status === "CALLED" ? (
                <span className="shrink-0 font-mono uppercase tracking-wider">
                  {t("queue.calledBadge")} · {formatRemaining(entry.expiresAt, now)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {calledForMe ? (
        <div className="flex flex-col gap-2 bg-primary/10 p-2">
          <p className="text-xs font-semibold text-primary">
            {t("queue.yourTurn", { time: formatRemaining(myEntryHere?.expiresAt ?? null, now) })}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={confirming}
            onClick={() => void run(() => occupy(table.id).unwrap())}
          >
            {t("tables.take")}
          </Button>
        </div>
      ) : myEntryHere ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={leaving}
          onClick={() => void run(() => leave(myEntryHere.id).unwrap())}
        >
          {t("queue.leave")}
        </Button>
      ) : canJoin ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={joining}
          onClick={() => void run(() => join(table.id).unwrap())}
        >
          {t("queue.join")}
        </Button>
      ) : null}
    </div>
  );
}

function TableCard({
  table,
  now,
  meId,
  myOccupiedTableId,
  myQueueEntry,
}: {
  table: BabyTable;
  now: number;
  meId?: string;
  myOccupiedTableId: string | null;
  myQueueEntry: QueueEntry | null;
}) {
  const { t } = useTranslation();
  const [occupy, { isLoading: occupying }] = useOccupyTableMutation();
  const [release, { isLoading: releasing }] = useReleaseTableMutation();
  const busy = table.status === "BUSY";
  const isMine = busy && table.occupiedBy?.id === meId;
  const blockedByOtherTable =
    !busy && myOccupiedTableId !== null && myOccupiedTableId !== table.id;
  const tie = table.currentTournamentTie;

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("tables.actionFailed")),
        type: "error",
      });
    }
  };

  if (tie) {
    return (
      <section className="flex min-h-72 flex-col gap-4 border border-primary/50 bg-primary/5 p-5">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold uppercase tracking-wider">{table.name}</h2>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            {t("tables.tournamentBadge")}
          </span>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-dashed border-border p-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {tie.tournamentName} · {translateRoundLabel(tie.roundLabel, t)}
          </p>
          <p className="text-sm font-bold">{tie.entryALabel}</p>
          <p className="text-[10px] uppercase text-muted-foreground">{t("matches.vs")}</p>
          <p className="text-sm font-bold">{tie.entryBLabel}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          render={<Link to={ROUTES.tournament(tie.tournamentId)} />}
        >
          {t("tables.viewTournament")}
        </Button>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "flex min-h-72 flex-col gap-4 border p-5",
        busy ? "border-chart-3/50 bg-chart-3/5" : "border-primary/50 bg-primary/5",
      )}
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold uppercase tracking-wider">{table.name}</h2>
        <span
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.2em]",
            busy ? "text-chart-3" : "text-primary",
          )}
        >
          {busy
            ? `${t("tables.busy")} ${formatElapsed(table.occupiedAt, now)}`
            : t("tables.free")}
        </span>
      </header>

      <div className="flex flex-1 items-center justify-center border border-dashed border-border p-4">
        {busy && table.occupiedBy ? (
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarImage
                src={resolveAvatarUrl(table.occupiedBy.avatarUrl)}
                alt={table.occupiedBy.displayname}
              />
              <AvatarFallback>{getInitials(table.occupiedBy.displayname)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{table.occupiedBy.displayname}</p>
              <p className="text-xs text-muted-foreground">
                {t("tables.since", {
                  time: table.occupiedAt
                    ? new Date(table.occupiedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "",
                })}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            — {t("tables.noMatch")} —
          </p>
        )}
      </div>

      {isMine ? (
        <ConfirmDialog
          title={t("tables.releaseTitle")}
          description={t("tables.releaseDescription", { name: table.name })}
          confirmLabel={t("tables.release")}
          loading={releasing}
          onConfirm={() => run(() => release(table.id).unwrap())}
        >
          <Button type="button" variant="outline" className="w-full">
            {t("tables.release")}
          </Button>
        </ConfirmDialog>
      ) : busy ? (
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {t("tables.occupiedByOther")}
        </p>
      ) : (
        <Button
          type="button"
          className="w-full"
          disabled={occupying || blockedByOtherTable}
          title={blockedByOtherTable ? t("tables.alreadyOnOther") : undefined}
          onClick={() => void run(() => occupy(table.id).unwrap())}
        >
          {t("tables.take")}
        </Button>
      )}
      {blockedByOtherTable ? (
        <p className="text-center text-[11px] text-muted-foreground">
          {t("tables.alreadyOnOther")}
        </p>
      ) : null}

      <QueueSection table={table} now={now} meId={meId} myEntry={myQueueEntry} />
    </section>
  );
}

export const Tables = () => {
  const { t } = useTranslation();
  const { data: tables = [], isLoading } = useListTablesQuery();
  const { data: me } = useMeQuery();
  const { data: myQueueEntry = null } = useGetMyQueueEntryQuery();
  const myOccupiedTableId =
    tables.find((table) => table.occupiedBy?.id === me?.id)?.id ?? null;
  const now = useNow(
    tables.some((table) => table.status === "BUSY") || myQueueEntry !== null,
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("tables.title")}</h1>
        <span className="text-[11px] uppercase tracking-[0.2em] text-primary">
          ● {t("tables.realtime")}
        </span>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              now={now}
              meId={me?.id}
              myOccupiedTableId={myOccupiedTableId}
              myQueueEntry={myQueueEntry}
            />
          ))}
        </div>
      )}
    </div>
  );
};
