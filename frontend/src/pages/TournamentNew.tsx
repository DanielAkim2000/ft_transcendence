import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useSearchUsersQuery } from "@/features/users/usersApi";
import { useMeQuery } from "@/features/auth/authApi";
import { useCreateTournamentMutation, type Tournament } from "@/features/tournaments/tournamentsApi";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import { useClampedPage } from "@/lib/use-clamped-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/get-error-message";
import { ROUTES } from "@/constants/routes";
import type { MatchFormat } from "@/features/matches/matchesApi";

const PLAYER_SEARCH_PAGE_SIZE = 8;

interface StagedEntry {
  key: string;
  player1Id: string;
  player2Id?: string;
  label: string;
}

export const TournamentNew = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<MatchFormat>("ONE_V_ONE");
  const [twoLegged, setTwoLegged] = useState(false);
  const [entries, setEntries] = useState<StagedEntry[]>([]);
  const [pendingPlayer1, setPendingPlayer1] = useState<{ id: string; displayname: string } | null>(null);
  const [query, setQuery] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const { data: searchData, isFetching: searching } = useSearchUsersQuery({
    q: query.trim() || undefined,
    page: searchPage,
    limit: PLAYER_SEARCH_PAGE_SIZE,
  });
  useClampedPage(searchPage, searchData?.totalPages, setSearchPage);
  const searchResults = searchData?.items ?? [];
  const { data: me } = useMeQuery();
  const q = query.trim().toLowerCase();
  // L'utilisateur connecté n'apparaît pas dans la recherche : on l'ajoute en tête de la première page.
  const results =
    me && searchPage === 1 && (q === "" || me.displayname.toLowerCase().includes(q))
      ? [me, ...searchResults]
      : searchResults;
  const [createTournament, { isLoading }] = useCreateTournamentMutation();

  const enteredIds = new Set(
    entries.flatMap((entry) => [entry.player1Id, entry.player2Id].filter((id): id is string => !!id)),
  );

  const pickUser = (user: { id: string; displayname: string }) => {
    if (enteredIds.has(user.id) || pendingPlayer1?.id === user.id) return;
    if (format === "ONE_V_ONE") {
      setEntries((prev) => [
        ...prev,
        { key: user.id, player1Id: user.id, label: user.displayname },
      ]);
      return;
    }
    if (!pendingPlayer1) {
      setPendingPlayer1(user);
      return;
    }
    setEntries((prev) => [
      ...prev,
      {
        key: `${pendingPlayer1.id}-${user.id}`,
        player1Id: pendingPlayer1.id,
        player2Id: user.id,
        label: `${pendingPlayer1.displayname} + ${user.displayname}`,
      },
    ]);
    setPendingPlayer1(null);
  };

  const removeEntry = (key: string) => {
    setEntries((prev) => prev.filter((entry) => entry.key !== key));
  };

  const submit = async () => {
    try {
      const tournament: Tournament = await createTournament({
        name: name.trim(),
        format,
        twoLegged,
        entries: entries.map(({ player1Id, player2Id }) => ({ player1Id, player2Id })),
      }).unwrap();
      navigate(ROUTES.tournament(tournament.id));
    } catch (error) {
      toast.add({ title: getErrorMessage(error, t("tournaments.actionFailed")), type: "error" });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("tournaments.createTitle")}</h1>

      <div className="flex flex-col gap-2">
        <Label>{t("tournaments.name")}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("tournaments.namePlaceholder")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("tournaments.format")}</Label>
        <RadioGroup
          value={format}
          onValueChange={(value) => {
            setFormat(value as MatchFormat);
            setEntries([]);
            setPendingPlayer1(null);
          }}
          className="flex flex-col gap-2"
        >
          <Label className="flex items-center gap-2 border border-border p-2 text-sm">
            <RadioGroupItem value="ONE_V_ONE" />
            {t("matches.oneVOne")}
          </Label>
          <Label className="flex items-center gap-2 border border-border p-2 text-sm">
            <RadioGroupItem value="TWO_V_TWO" />
            {t("matches.twoVTwo")}
          </Label>
        </RadioGroup>
      </div>

      <Label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={twoLegged}
          onChange={(e) => setTwoLegged(e.target.checked)}
          className="size-4"
        />
        {t("tournaments.twoLeggedOption")}
      </Label>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("tournaments.entries")} · {entries.length}
        </h2>
        {format === "TWO_V_TWO" && pendingPlayer1 ? (
          <p className="text-xs text-primary">
            {t("tournaments.pickSecondPlayer", { name: pendingPlayer1.displayname })}
          </p>
        ) : null}
        {entries.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {entries.map((entry) => (
              <li
                key={entry.key}
                className="flex items-center justify-between gap-2 border border-border px-2 py-1 text-sm"
              >
                {entry.label}
                <Button type="button" size="sm" variant="outline" onClick={() => removeEntry(entry.key)}>
                  {t("tournaments.removeEntry")}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchPage(1);
          }}
          placeholder={t("tournaments.searchPlayer")}
        />
        <ul className="flex flex-col gap-1">
          {results
            .filter((user) => !enteredIds.has(user.id) && pendingPlayer1?.id !== user.id)
            .map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => pickUser(user)}
                  className="w-full border border-border px-2 py-1 text-left text-sm hover:border-primary/50"
                >
                  {user.displayname}
                </button>
              </li>
            ))}
        </ul>
        <Pagination
          page={searchData?.page ?? searchPage}
          totalPages={searchData?.totalPages ?? 1}
          onPageChange={setSearchPage}
          disabled={searching}
        />
      </div>

      <Button
        type="button"
        loading={isLoading} disabled={!name.trim()}
        onClick={() => void submit()}
      >
        {t("tournaments.create")}
      </Button>
    </div>
  );
};
