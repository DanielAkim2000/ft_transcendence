import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageFallback } from "@/components/page-fallback";
import { toast } from "@/components/ui/toast";
import {
  useCreateTableMutation,
  useDeleteTableMutation,
  useListTablesQuery,
  useRenameTableMutation,
  type BabyTable,
} from "@/features/tables/tablesApi";
import { AdminReleaseTableButton } from "@/features/tables/AdminReleaseTableButton";
import { getErrorMessage } from "@/lib/get-error-message";

const MAX_NAME_LENGTH = 32;

/** Gestion des tables par un administrateur : création, renommage et suppression (uniquement si la table n'est pas utilisée). */
export const AdminTables = () => {
  const { t } = useTranslation();
  const { data: tables, isLoading } = useListTablesQuery();
  const [createTable, { isLoading: creating }] = useCreateTableMutation();
  const [renameTable, { isLoading: renaming }] = useRenameTableMutation();
  const [deleteTable] = useDeleteTableMutation();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.add({ title: success, type: "success" });
      return true;
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("admin.tables.actionFailed")),
        type: "error",
      });
      return false;
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    if (await run(() => createTable(name).unwrap(), t("admin.tables.createdToast"))) {
      setNewName("");
    }
  };

  const startEditing = (table: BabyTable) => {
    setEditingId(table.id);
    setDraftName(table.name);
  };

  const handleRename = async (table: BabyTable) => {
    const name = draftName.trim();
    if (!name || name === table.name) {
      setEditingId(null);
      return;
    }
    if (
      await run(
        () => renameTable({ id: table.id, name }).unwrap(),
        t("admin.tables.renamedToast"),
      )
    ) {
      setEditingId(null);
    }
  };

  if (isLoading || !tables) {
    return <PageFallback />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("admin.tables.title")}
        </h1>
        <p className="mt-1 font-sans text-sm text-muted-foreground">
          {t("admin.tables.description")}
        </p>
      </header>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder={t("admin.tables.namePlaceholder")}
          aria-label={t("admin.tables.namePlaceholder")}
        />
        <Button type="submit" disabled={creating || newName.trim() === ""}>
          {t("admin.tables.create")}
        </Button>
      </form>

      {tables.length === 0 ? (
        <p className="font-sans text-sm text-muted-foreground">
          {t("admin.tables.none")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tables.map((table) => (
            <li
              key={table.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              {editingId === table.id ? (
                <form
                  className="flex min-w-0 flex-1 gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleRename(table);
                  }}
                >
                  <Input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    maxLength={MAX_NAME_LENGTH}
                    autoFocus
                    aria-label={t("admin.tables.namePlaceholder")}
                  />
                  <Button type="submit" size="sm" loading={renaming}>
                    {t("admin.tables.save")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                  >
                    {t("common.cancel")}
                  </Button>
                </form>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-sm font-medium">
                      {table.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {table.status === "FREE" ? t("tables.free") : t("tables.busy")}
                      {table.currentTournamentTie
                        ? ` · ${t("tables.tournamentBadge")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <AdminReleaseTableButton table={table} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing(table)}
                    >
                      {t("admin.tables.rename")}
                    </Button>
                    <ConfirmDialog
                      title={t("admin.tables.deleteTitle", { name: table.name })}
                      description={t("admin.tables.deleteDescription")}
                      confirmLabel={t("admin.tables.delete")}
                      onConfirm={async () => {
                        await run(
                          () => deleteTable(table.id).unwrap(),
                          t("admin.tables.deletedToast"),
                        );
                      }}
                    >
                      <Button type="button" size="sm" variant="destructive">
                        {t("admin.tables.delete")}
                      </Button>
                    </ConfirmDialog>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
