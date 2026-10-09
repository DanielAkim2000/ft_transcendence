import { useState, type ReactElement, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  children: ReactElement;
  title: string;
  description: string;
  /** Contenu libre affiché sous la description (ex. récapitulatif à vérifier). */
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  children,
  title,
  description,
  body,
  confirmLabel,
  cancelLabel,
  variant = "destructive",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  };

  const busy = loading || pending;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (busy && !next) return;
        setOpen(next);
      }}
    >
      <Dialog.Trigger render={children} />
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-lg outline-none",
            "data-ending-style:opacity-0 data-starting-style:opacity-0",
          )}
        >
          <Dialog.Title className="font-heading text-lg font-semibold">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 font-sans text-sm text-muted-foreground">
            {description}
          </Dialog.Description>
          {body}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close
              disabled={busy}
              render={<Button type="button" variant="outline" />}
            >
              {cancelLabel ?? t("common.cancel")}
            </Dialog.Close>
            <Button
              type="button"
              variant={variant === "destructive" ? "destructive" : "default"}
              disabled={busy}
              onClick={() => {
                void handleConfirm();
              }}
            >
              {confirmLabel ?? t("common.confirm")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
