import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "@base-ui/react/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { FriendPicker } from "@/features/users/FriendPicker";
import { getErrorMessage } from "@/lib/get-error-message";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { cn } from "@/lib/utils";
import {
  useRespondMatchMutation,
  useSubmitScoreMutation,
  useValidateScoreMutation,
  type Match,
  type MatchPlayer,
} from "./matchesApi";
import { teamOf } from "./matchHelpers";

function TeamNames({ team }: { team: MatchPlayer[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {team.map((player) => (
        <span key={player.id} className="flex items-center gap-1">
          <TeamAvatar player={player} />
          {player.displayname}
        </span>
      ))}
    </span>
  );
}

function AcceptTwoVTwoDialog({
  match,
  children,
}: {
  match: Match;
  children: React.ReactElement;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [teammateId, setTeammateId] = useState<string>("");
  const teamAIds = match.teamA.map((player) => player.id);
  const [respond, { isLoading }] = useRespondMatchMutation();

  const submit = async () => {
    if (!teammateId) return;
    try {
      await respond({ matchId: match.id, accept: true, teammateId }).unwrap();
      setOpen(false);
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("matches.actionFailed")),
        type: "error",
      });
    }
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
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-border bg-card p-5 text-card-foreground shadow-lg outline-none data-ending-style:opacity-0 data-starting-style:opacity-0">
          <Dialog.Title className="text-base font-bold uppercase tracking-wider">
            {t("matches.pickTeammateTitle")}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {t("matches.pickTeammateDescription")}
          </Dialog.Description>
          <div className="mt-4">
            <FriendPicker value={teammateId} onChange={setTeammateId} excludeIds={teamAIds} />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close
              disabled={isLoading}
              render={<Button type="button" variant="outline" />}
            >
              {t("common.cancel")}
            </Dialog.Close>
            <Button
              type="button"
              disabled={isLoading || !teammateId}
              onClick={() => void submit()}
            >
              {t("matches.accept")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function MatchCard({ match, meId }: { match: Match; meId: string }) {
  const { t } = useTranslation();
  const [respond, { isLoading: responding }] = useRespondMatchMutation();
  const [submitScore, { isLoading: submitting }] = useSubmitScoreMutation();
  const [validateScore, { isLoading: validating }] = useValidateScoreMutation();
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");

  const myTeam = teamOf(match, meId);
  const formatLabel = t(match.format === "ONE_V_ONE" ? "matches.oneVOne" : "matches.twoVTwo");

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("matches.actionFailed")),
        type: "error",
      });
    }
  };

  const decline = () => run(() => respond({ matchId: match.id, accept: false }).unwrap());
  const acceptSolo = () => run(() => respond({ matchId: match.id, accept: true }).unwrap());

  const submit = () => {
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return;
    void run(() => submitScore({ matchId: match.id, scoreA: a, scoreB: b }).unwrap());
  };

  return (
    <li className="flex flex-col gap-2 border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <TeamNames team={match.teamA} />
          <span className="text-muted-foreground">{t("matches.vs")}</span>
          <TeamNames team={match.teamB} />
        </div>
        <span className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {formatLabel}
        </span>
      </div>

      {match.status === "PENDING" && myTeam === "B" ? (
        <div className="flex items-center gap-2">
          <p className="flex-1 text-xs text-muted-foreground">{t("matches.pendingForYou")}</p>
          {match.format === "TWO_V_TWO" ? (
            <AcceptTwoVTwoDialog match={match}>
              <Button type="button" size="sm">
                {t("matches.accept")}
              </Button>
            </AcceptTwoVTwoDialog>
          ) : (
            <Button type="button" size="sm" disabled={responding} onClick={() => void acceptSolo()}>
              {t("matches.accept")}
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" disabled={responding} onClick={() => void decline()}>
            {t("matches.decline")}
          </Button>
        </div>
      ) : null}

      {match.status === "PENDING" && myTeam === "A" ? (
        <p className="text-xs text-muted-foreground">{t("matches.pendingForOpponent")}</p>
      ) : null}

      {match.status === "DECLINED" ? (
        <p className="text-xs text-muted-foreground">{t("matches.declined")}</p>
      ) : null}

      {match.status === "ACCEPTED" ? (
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase text-muted-foreground">
              {t("matches.scoreOfTeamA")}
            </Label>
            <Input
              type="number"
              min={0}
              className="w-16"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase text-muted-foreground">
              {t("matches.scoreOfTeamB")}
            </Label>
            <Input
              type="number"
              min={0}
              className="w-16"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={submitting || scoreA === "" || scoreB === ""}
            onClick={submit}
          >
            {t("matches.submitScore")}
          </Button>
        </div>
      ) : null}

      {match.status === "PENDING_VALIDATION" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs">
            {t("matches.scoreSubmitted", { a: match.scoreA, b: match.scoreB })}
          </p>
          {myTeam !== null && match.submittedBy && teamOf(match, match.submittedBy.id) !== myTeam ? (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={validating}
                onClick={() => void run(() => validateScore({ matchId: match.id, accept: true }).unwrap())}
              >
                {t("matches.validate")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={validating}
                onClick={() => void run(() => validateScore({ matchId: match.id, accept: false }).unwrap())}
              >
                {t("matches.dispute")}
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{t("matches.awaitingValidation")}</span>
          )}
        </div>
      ) : null}

      {match.status === "COMPLETED" ? (
        <p className={cn("text-xs font-semibold", "text-primary")}>
          {t("matches.completed", { a: match.scoreA, b: match.scoreB })}
        </p>
      ) : null}

      {match.status === "DISPUTED" ? (
        <p className="text-xs text-destructive">
          {t("matches.disputedResult", { a: match.scoreA, b: match.scoreB })}
        </p>
      ) : null}
    </li>
  );
}

export function TeamAvatar({ player }: { player: MatchPlayer }) {
  return (
    <Avatar className="size-6">
      <AvatarImage src={resolveAvatarUrl(player.avatarUrl)} alt={player.displayname} />
      <AvatarFallback className="text-[10px]">{getInitials(player.displayname)}</AvatarFallback>
    </Avatar>
  );
}
