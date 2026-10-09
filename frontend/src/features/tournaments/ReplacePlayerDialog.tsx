import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { toast } from "@/components/ui/toast";
import { useAdminListUsersQuery } from "@/features/admin/adminApi";
import {
  useReplaceTournamentPlayerMutation,
  type TournamentEntry,
} from "@/features/tournaments/tournamentsApi";
import { getErrorMessage } from "@/lib/get-error-message";
import { useClampedPage } from "@/lib/use-clamped-page";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";

const SEARCH_PAGE_SIZE = 6;

type Props = {
  tournamentId: string;
  entry: TournamentEntry;
  /** Joueurs déjà inscrits au tournoi : ils ne peuvent pas servir de remplaçant. */
  enteredIds: Set<string>;
};

/** Fenêtre (admin) pour remplacer un joueur d'une équipe, par exemple quand elle ne peut plus jouer sa demi-finale. */
export function ReplacePlayerDialog({ tournamentId, entry, enteredIds }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [playerId, setPlayerId] = useState(entry.player1.id);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [replacement, setReplacement] = useState<{
    id: string;
    displayname: string;
  } | null>(null);
  const debouncedQuery = useDebouncedValue(query.trim());
  const { data, isFetching } = useAdminListUsersQuery(
    { q: debouncedQuery || undefined, page, limit: SEARCH_PAGE_SIZE },
    { skip: !open },
  );
  const [replacePlayer, { isLoading }] = useReplaceTournamentPlayerMutation();
  useClampedPage(page, data?.totalPages, setPage);

  const players = [entry.player1, entry.player2].filter(
    (player): player is NonNullable<typeof player> => !!player,
  );
  const outgoing = players.find((player) => player.id === playerId) ?? entry.player1;
  const candidates = (data?.items ?? []).filter((user) => !enteredIds.has(user.id));

  const reset = () => {
    setQuery("");
    setPage(1);
    setReplacement(null);
    setPlayerId(entry.player1.id);
  };

  const handleConfirm = async () => {
    if (!replacement) return;
    try {
      await replacePlayer({
        id: tournamentId,
        entryId: entry.id,
        playerId: outgoing.id,
        replacementId: replacement.id,
      }).unwrap();
      toast.add({
        title: t("tournaments.replaceDoneToast", {
          from: outgoing.displayname,
          to: replacement.displayname,
        }),
        type: "success",
      });
      setOpen(false);
      reset();
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("tournaments.replaceFailed")),
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
        if (!next) reset();
      }}
    >
      <Dialog.Trigger render={<Button type="button" size="sm" variant="outline" />}>
        {t("tournaments.replacePlayer")}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg outline-none data-ending-style:opacity-0 data-starting-style:opacity-0">
          <Dialog.Title className="font-heading text-lg font-semibold">
            {t("tournaments.replaceTitle")}
          </Dialog.Title>
          <Dialog.Description className="mt-1 font-sans text-sm text-muted-foreground">
            {t("tournaments.replaceDescription")}
          </Dialog.Description>

          {players.length > 1 ? (
            <div className="mt-4 flex flex-col gap-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {t("tournaments.replaceWho")}
              </p>
              <div className="flex gap-2">
                {players.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => setPlayerId(player.id)}
                    className={cn(
                      "flex-1 border px-2 py-1 text-left text-sm",
                      player.id === outgoing.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    {player.displayname}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={t("tournaments.searchPlayer")}
              aria-label={t("tournaments.searchPlayer")}
            />
            <ul className="flex flex-col gap-1">
              {candidates.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => setReplacement(user)}
                    className={cn(
                      "w-full border px-2 py-1 text-left text-sm",
                      replacement?.id === user.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    {user.displayname}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Pagination
              page={data?.page ?? page}
              totalPages={data?.totalPages ?? 1}
              onPageChange={setPage}
              disabled={isFetching}
            />
          </div>

          {replacement ? (
            <p className="mt-3 text-sm text-primary">
              {t("tournaments.replaceSummary", {
                from: outgoing.displayname,
                to: replacement.displayname,
              })}
            </p>
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
              disabled={!replacement || isLoading}
              onClick={() => void handleConfirm()}
            >
              {t("tournaments.replaceConfirm")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
