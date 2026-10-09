import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Dialog } from "@base-ui/react/dialog";
import { useMeQuery } from "@/features/auth/authApi";
import { AdminReleaseTableButton } from "@/features/tables/AdminReleaseTableButton";
import { ScoreConfirmDialog } from "@/components/score-confirm-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "@/components/ui/toast";
import {
  useListTablesQuery,
  useVoteReleaseTableMutation,
  type BabyTable,
  type TableGroup,
} from "@/features/tables/tablesApi";
import {
  useConfirmQueueGroupMutation,
  useGetMyQueueGroupQuery,
  useJoinQueueMutation,
  useLeaveQueueGroupMutation,
  useListQueueQuery,
  useRespondQueueInviteMutation,
  type QueueGroup,
} from "@/features/queue/queueApi";
import { useSubmitScoreMutation, type MatchFormat } from "@/features/matches/matchesApi";
import { FriendPicker } from "@/features/users/FriendPicker";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatElapsed, formatRemaining, useNow } from "@/lib/elapsed";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { translateRoundLabel } from "@/features/tournaments/tournamentHelpers";
import { CardSkeleton } from "@/components/skeletons";

const TARGET_SCORE = 10;

/** Exécute une action et affiche un toast d'erreur en cas d'échec. */
function useRun() {
  const { t } = useTranslation();
  return async (action: () => Promise<unknown>, successMessage?: string) => {
    try {
      await action();
      if (successMessage) toast.add({ title: successMessage, type: "success" });
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("tables.actionFailed")),
        type: "error",
      });
    }
  };
}

function formatLabel(t: (key: string) => string, format: MatchFormat): string {
  return t(format === "ONE_V_ONE" ? "matches.oneVOne" : "matches.twoVTwo");
}

function PlayerChip({ player }: { player: { displayname: string; avatarUrl: string | null } }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-9">
        <AvatarImage src={resolveAvatarUrl(player.avatarUrl)} alt={player.displayname} />
        <AvatarFallback>{getInitials(player.displayname)}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm font-bold">{player.displayname}</span>
    </div>
  );
}

function SideCard({
  index,
  group,
  meId,
}: {
  index: number;
  group: TableGroup | undefined;
  meId?: string;
}) {
  const { t } = useTranslation();
  const isMine = group?.players.some((player) => player.id === meId) ?? false;
  return (
    <div
      className={cn(
        "flex min-h-24 flex-1 flex-col gap-2 border border-dashed border-border p-3",
        isMine && "border-solid border-primary/60 bg-primary/5",
      )}
    >
      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {t("tables.team", { n: index + 1 })}
      </span>
      {group ? (
        group.players.map((player) => <PlayerChip key={player.id} player={player} />)
      ) : (
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          — {t("tables.freeSpot")} —
        </span>
      )}
    </div>
  );
}

/** Saisie du score final d'un match de table : un côté a 10 points, l'autre moins. */
function ScoreForm({ table }: { table: BabyTable }) {
  const { t } = useTranslation();
  const run = useRun();
  const [submitScore, { isLoading }] = useSubmitScoreMutation();
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const a = Number(scoreA);
  const b = Number(scoreB);
  const filled = scoreA !== "" && scoreB !== "";
  const valid =
    filled &&
    Number.isInteger(a) &&
    Number.isInteger(b) &&
    a >= 0 &&
    b >= 0 &&
    ((a === TARGET_SCORE && b < TARGET_SCORE) || (b === TARGET_SCORE && a < TARGET_SCORE));
  const label = (group: TableGroup | undefined) =>
    group?.players.map((player) => player.displayname).join(" + ") ?? "";
  const [groupA, groupB] = [table.groups[0], table.groups[1]];

  return (
    <div className="flex flex-col gap-2 border border-border p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {t("tables.scoreTitle")}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label className="max-w-32 truncate text-[10px] uppercase text-muted-foreground">
            {label(groupA)}
          </Label>
          <Input
            type="number"
            min={0}
            max={TARGET_SCORE}
            className="w-16"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="max-w-32 truncate text-[10px] uppercase text-muted-foreground">
            {label(groupB)}
          </Label>
          <Input
            type="number"
            min={0}
            max={TARGET_SCORE}
            className="w-16"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
          />
        </div>
        <ScoreConfirmDialog
          kind="table"
          teamA={label(groupA)}
          teamB={label(groupB)}
          scoreA={a}
          scoreB={b}
          onConfirm={() =>
            run(
              () =>
                submitScore({
                  matchId: table.currentMatchId ?? "",
                  scoreA: a,
                  scoreB: b,
                }).unwrap(),
              t("matches.scoreSentToast", { a, b }),
            )
          }
        >
          <Button type="button" size="sm" disabled={isLoading || !valid}>
            {t("matches.submitScore")}
          </Button>
        </ScoreConfirmDialog>
      </div>
      <p className={cn("text-[11px]", filled && !valid ? "text-destructive" : "text-muted-foreground")}>
        {filled && !valid ? t("tables.scoreInvalid") : t("tables.scoreHint")}
      </p>
    </div>
  );
}

/** Fenêtre pour créer son groupe sur une table : format (si la table est vide) et ami (en 2v2). */
function JoinDialog({
  table,
  children,
}: {
  table: BabyTable;
  children: React.ReactElement;
}) {
  const { t } = useTranslation();
  const run = useRun();
  const [open, setOpen] = useState(false);
  const [pickedFormat, setPickedFormat] = useState<MatchFormat>("ONE_V_ONE");
  const [teammateId, setTeammateId] = useState("");
  const [join, { isLoading }] = useJoinQueueMutation();
  const format = table.format ?? pickedFormat;
  const isTwoVTwo = format === "TWO_V_TWO";

  const submit = async () => {
    await run(async () => {
      await join({
        tableId: table.id,
        format: table.format ? undefined : format,
        teammateId: isTwoVTwo ? teammateId : undefined,
      }).unwrap();
      setOpen(false);
      setTeammateId("");
    });
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (isLoading && !next) return;
        setOpen(next);
      }}
    >
      <Dialog.Trigger render={children} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-border bg-card p-5 text-card-foreground shadow-lg outline-none data-ending-style:opacity-0 data-starting-style:opacity-0">
          <Dialog.Title className="text-base font-bold uppercase tracking-wider">
            {t("queue.joinTitle", { table: table.name })}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {table.format
              ? t("queue.formatLocked", { format: formatLabel(t, table.format) })
              : t("queue.joinFormat")}
          </Dialog.Description>

          {table.format ? null : (
            <RadioGroup
              value={pickedFormat}
              onValueChange={(value) => setPickedFormat(value as MatchFormat)}
              className="mt-4 flex flex-col gap-2"
            >
              {(["ONE_V_ONE", "TWO_V_TWO"] as const).map((option) => (
                <Label
                  key={option}
                  className="flex items-center gap-2 border border-border p-2 text-sm"
                >
                  <RadioGroupItem value={option} />
                  {formatLabel(t, option)}
                </Label>
              ))}
            </RadioGroup>
          )}

          {isTwoVTwo ? (
            <div className="mt-4">
              <p className="text-sm font-semibold">{t("queue.pickFriendTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("queue.pickFriendDescription")}
              </p>
              <div className="mt-3">
                <FriendPicker value={teammateId} onChange={setTeammateId} />
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close
              disabled={isLoading}
              render={<Button type="button" variant="outline" />}
            >
              {t("common.cancel")}
            </Dialog.Close>
            <Button
              type="button"
              disabled={isLoading || (isTwoVTwo && !teammateId)}
              onClick={() => void submit()}
            >
              {isTwoVTwo ? t("queue.invite") : t("queue.joinConfirm")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function groupNames(group: QueueGroup): string {
  return group.players.map((player) => player.displayname).join(" + ");
}

function QueueSection({
  table,
  now,
  meId,
  myGroup,
}: {
  table: BabyTable;
  now: number;
  meId?: string;
  myGroup: QueueGroup | null;
}) {
  const { t } = useTranslation();
  const run = useRun();
  const { data: groups = [] } = useListQueueQuery(table.id);
  const [confirm, { isLoading: confirming }] = useConfirmQueueGroupMutation();
  const [leave, { isLoading: leaving }] = useLeaveQueueGroupMutation();
  const myGroupHere = myGroup?.tableId === table.id ? myGroup : null;
  const calledForMe = myGroupHere?.status === "CALLED";
  const inQueue = myGroupHere?.status === "WAITING" || calledForMe;

  if (groups.length === 0 && !inQueue) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {t("queue.title")} · {groups.length}
      </h3>
      <ul className="flex flex-col gap-1">
        {groups.map((group) => {
          const mine = group.players.some((player) => player.id === meId);
          return (
            <li
              key={group.id}
              className={cn(
                "flex items-center justify-between gap-2 px-2 py-1 text-xs",
                group.status === "CALLED" && "bg-primary/10 text-primary",
                mine && "font-bold",
              )}
            >
              <span className="truncate">
                {group.position}. {groupNames(group)}
              </span>
              {group.status === "CALLED" ? (
                <span className="shrink-0 font-mono uppercase tracking-wider">
                  {t("queue.calledBadge")} · {formatRemaining(group.expiresAt, now)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {calledForMe && myGroupHere ? (
        <div className="flex flex-col gap-2 bg-primary/10 p-2">
          <p className="text-xs font-semibold text-primary">
            {t("queue.yourTurn", { time: formatRemaining(myGroupHere.expiresAt, now) })}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={confirming}
            onClick={() => void run(() => confirm(myGroupHere.id).unwrap())}
          >
            {t("queue.confirm")}
          </Button>
        </div>
      ) : null}
      {inQueue && myGroupHere ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={leaving}
          onClick={() => void run(() => leave(myGroupHere.id).unwrap())}
        >
          {t("queue.leave")}
        </Button>
      ) : null}
    </div>
  );
}

function TableActions({
  table,
  meId,
  myGroup,
}: {
  table: BabyTable;
  meId?: string;
  myGroup: QueueGroup | null;
}) {
  const { t } = useTranslation();
  const run = useRun();
  const [vote, { isLoading: voting }] = useVoteReleaseTableMutation();
  const [leave, { isLoading: leaving }] = useLeaveQueueGroupMutation();
  const [showScore, setShowScore] = useState(false);
  const playerIds = new Set(
    table.groups.flatMap((group) => group.players.map((player) => player.id)),
  );
  const playing = meId ? playerIds.has(meId) : false;
  const myGroupHere = myGroup?.tableId === table.id ? myGroup : null;
  const hasVoted = meId ? table.releaseVoterIds.includes(meId) : false;
  const playerVoteCount = table.releaseVoterIds.filter((id) => playerIds.has(id)).length;
  const externalVoteCount = table.releaseVoterIds.length - playerVoteCount;
  const queueEmpty = !myGroup;
  const canJoin = queueEmpty && !table.currentTournamentTie;

  if (playing && table.currentMatchId) {
    return (
      <div className="flex flex-col gap-3">
        {table.endRequestedAt ? (
          <>
            <p className="text-xs font-semibold text-primary">{t("tables.scoreRequired")}</p>
            <ScoreForm table={table} />
          </>
        ) : (
          <>
            {playerVoteCount > 0 ? (
              <p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {t("tables.releaseVotes", { count: playerVoteCount })}
              </p>
            ) : null}
            {hasVoted ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={voting}
                onClick={() => void run(() => vote(table.id).unwrap())}
              >
                {t("tables.cancelRelease")}
              </Button>
            ) : (
              <ConfirmDialog
                title={t("tables.releaseTitle")}
                description={t("tables.releaseDescription", { name: table.name })}
                confirmLabel={t("tables.release")}
                loading={voting}
                onConfirm={() => run(() => vote(table.id).unwrap())}
              >
                <Button type="button" variant="outline" className="w-full">
                  {t("tables.release")}
                </Button>
              </ConfirmDialog>
            )}
            {showScore ? (
              <ScoreForm table={table} />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowScore(true)}
              >
                {t("tables.enterScore")}
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  if (playing && myGroupHere) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {t("tables.waitingOpponent")}
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={leaving}
          onClick={() => void run(() => leave(myGroupHere.id).unwrap())}
        >
          {t("tables.leaveTable")}
        </Button>
      </div>
    );
  }

  if (table.endRequestedAt) {
    return (
      <p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {t("tables.scoreWaiting")}
      </p>
    );
  }

  // Spectateur (ou joueur en file ailleurs) : peut signaler la table comme
  // abandonnée (2 votes distincts d'utilisateurs extérieurs au match
  // suffisent à l'annuler) et/ou rejoindre la file de cette table.
  const externalVoteBlock = table.currentMatchId ? (
    <div className="flex flex-col gap-2">
      {externalVoteCount > 0 ? (
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {t("tables.forceReleaseVotes", { count: externalVoteCount })}
        </p>
      ) : null}
      {hasVoted ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={voting}
          onClick={() => void run(() => vote(table.id).unwrap())}
        >
          {t("tables.cancelRelease")}
        </Button>
      ) : (
        <ConfirmDialog
          title={t("tables.forceReleaseTitle")}
          description={t("tables.forceReleaseDescription", { name: table.name })}
          confirmLabel={t("tables.reportFree")}
          loading={voting}
          onConfirm={() => run(() => vote(table.id).unwrap())}
        >
          <Button type="button" variant="outline" className="w-full">
            {t("tables.reportFree")}
          </Button>
        </ConfirmDialog>
      )}
    </div>
  ) : null;

  const joinBlock = canJoin ? (
    <JoinDialog table={table}>
      <Button type="button" className="w-full">
        {table.groups.length === 0 && !table.format ? t("tables.take") : t("queue.join")}
      </Button>
    </JoinDialog>
  ) : null;

  if (!externalVoteBlock && !joinBlock) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {externalVoteBlock}
      {joinBlock}
    </div>
  );
}

function TableCard({
  table,
  now,
  meId,
  myGroup,
}: {
  table: BabyTable;
  now: number;
  meId?: string;
  myGroup: QueueGroup | null;
}) {
  const { t } = useTranslation();
  const { data: me } = useMeQuery();
  const busy = table.status === "BUSY";
  const tie = table.currentTournamentTie;
  const inMatch = table.currentMatchId !== null;

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
        <h2 className="text-base font-bold uppercase tracking-wider">
          {table.name}
          {table.format ? (
            <span className="ml-2 text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">
              {formatLabel(t, table.format)}
            </span>
          ) : null}
        </h2>
        <span
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.2em]",
            busy ? "text-chart-3" : "text-primary",
          )}
        >
          {busy
            ? inMatch
              ? `${t("tables.busy")} ${formatElapsed(table.occupiedAt, now)}`
              : t("tables.busy")
            : t("tables.free")}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-stretch">
        {busy || table.groups.length > 0 ? (
          <>
            <SideCard
              index={0}
              group={table.groups.find((group) => group.slot === 0)}
              meId={meId}
            />
            <span className="self-center text-[10px] uppercase text-muted-foreground">
              {t("matches.vs")}
            </span>
            <SideCard
              index={1}
              group={table.groups.find((group) => group.slot === 1)}
              meId={meId}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center border border-dashed border-border p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              — {t("tables.noMatch")} —
            </p>
          </div>
        )}
      </div>

      <TableActions table={table} meId={meId} myGroup={myGroup} />
      <QueueSection table={table} now={now} meId={meId} myGroup={myGroup} />
      {me?.role === "ADMIN" ? (
        <div className="flex justify-end">
          <AdminReleaseTableButton table={table} />
        </div>
      ) : null}
    </section>
  );
}

/** Bandeau de l'utilisateur pour un groupe en cours d'invitation (reçue ou envoyée). */
function InviteBanner({
  group,
  meId,
  tableName,
}: {
  group: QueueGroup;
  meId?: string;
  tableName: string;
}) {
  const { t } = useTranslation();
  const run = useRun();
  const [respond, { isLoading: responding }] = useRespondQueueInviteMutation();
  const [leave, { isLoading: leaving }] = useLeaveQueueGroupMutation();
  const requester = group.players.find((player) => player.isRequester);
  const invited = group.players.find((player) => !player.isRequester);
  const iAmInvited = invited?.id === meId;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-primary/60 bg-primary/10 px-4 py-3">
      <p className="text-sm">
        <span className="mr-2 text-primary">▲</span>
        {iAmInvited
          ? t("queue.inviteBanner", { name: requester?.displayname ?? "?", table: tableName })
          : t("queue.waitingFriend", { name: invited?.displayname ?? "?" })}
      </p>
      {iAmInvited ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={responding}
            onClick={() => void run(() => respond({ groupId: group.id, accept: true }).unwrap())}
          >
            {t("matches.accept")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={responding}
            onClick={() => void run(() => respond({ groupId: group.id, accept: false }).unwrap())}
          >
            {t("matches.decline")}
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={leaving}
          onClick={() => void run(() => leave(group.id).unwrap())}
        >
          {t("queue.cancelInvite")}
        </Button>
      )}
    </div>
  );
}

export const Tables = () => {
  const { t } = useTranslation();
  const { data: tables = [], isLoading } = useListTablesQuery();
  const { data: me } = useMeQuery();
  const { data: myGroup = null } = useGetMyQueueGroupQuery();
  const now = useNow(tables.some((table) => table.status === "BUSY") || myGroup !== null);
  const inviteTable =
    myGroup?.status === "INVITING"
      ? (tables.find((table) => table.id === myGroup.tableId)?.name ?? "?")
      : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("tables.title")}</h1>
        <span className="text-[11px] uppercase tracking-[0.2em] text-primary">
          ● {t("tables.realtime")}
        </span>
      </header>
      {myGroup && inviteTable !== null ? (
        <InviteBanner group={myGroup} meId={me?.id} tableName={inviteTable} />
      ) : null}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton lines={6} className="min-h-72" />
          <CardSkeleton lines={6} className="min-h-72" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              now={now}
              meId={me?.id}
              myGroup={myGroup}
            />
          ))}
        </div>
      )}
    </div>
  );
};
