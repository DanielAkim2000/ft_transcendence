import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/get-error-message";
import { useExportMyDataMutation, type ExportFormat } from "./gdprApi";

const MIME: Record<ExportFormat, string> = {
  csv: "text/csv;charset=utf-8",
  json: "application/json;charset=utf-8",
};

/** Bouton « Télécharger mes données » : ouvre un choix de format (CSV ou JSON), puis télécharge le fichier. */
export function ExportDataDialog({
  children,
}: {
  children: React.ReactElement;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [exportData, { isLoading }] = useExportMyDataMutation();

  const download = async (format: ExportFormat) => {
    try {
      const content = await exportData(format).unwrap();
      const url = URL.createObjectURL(
        new Blob([content], { type: MIME[format] }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `ft_transcendence_data_${new Date().toISOString().slice(0, 10)}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      setOpen(false);
      toast.add({ title: t("settings.privacy.exportDone"), type: "success" });
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("settings.privacy.exportFailed")),
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
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg outline-none data-ending-style:opacity-0 data-starting-style:opacity-0">
          <Dialog.Title className="font-heading text-lg font-semibold">
            {t("settings.privacy.formatTitle")}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {t("settings.privacy.formatDescription")}
          </Dialog.Description>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["csv", "json"] as const).map((format) => (
              <button
                key={format}
                type="button"
                disabled={isLoading}
                onClick={() => void download(format)}
                className="flex flex-col items-start gap-1 border border-border p-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
              >
                <span className="text-sm font-bold uppercase tracking-wider">
                  {format}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`settings.privacy.format_${format}`)}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <Dialog.Close
              disabled={isLoading}
              render={<Button type="button" variant="outline" />}
            >
              {t("common.cancel")}
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
