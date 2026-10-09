import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "@/components/ui/toast";
import {
  useAdminReleaseTableMutation,
  type BabyTable,
} from "@/features/tables/tablesApi";
import { getErrorMessage } from "@/lib/get-error-message";

/** Admin : libère une table occupée quand il le décide (match annulé sans score, joueurs sortis, la file avance). Absent pour une table libre ou occupée par un match de tournoi (il faut alors en saisir le score). */
export function AdminReleaseTableButton({ table }: { table: BabyTable }) {
  const { t } = useTranslation();
  const [release] = useAdminReleaseTableMutation();

  if (table.currentTournamentTie) return null;
  if (table.status !== "BUSY" && table.groups.length === 0) return null;

  const handleRelease = async () => {
    try {
      await release(table.id).unwrap();
      toast.add({
        title: t("tables.adminRelease.doneToast", { name: table.name }),
        type: "success",
      });
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("tables.adminRelease.failed")),
        type: "error",
      });
    }
  };

  return (
    <ConfirmDialog
      title={t("tables.adminRelease.title", { name: table.name })}
      description={t("tables.adminRelease.description")}
      confirmLabel={t("tables.adminRelease.confirm")}
      onConfirm={handleRelease}
    >
      <Button type="button" size="sm" variant="destructive">
        {t("tables.adminRelease.action")}
      </Button>
    </ConfirmDialog>
  );
}
