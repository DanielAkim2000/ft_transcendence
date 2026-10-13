import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "@base-ui/react/dialog";
import { FriendPicker } from "@/features/users/FriendPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/toast";
import { ROUTES } from "@/constants/routes";
import { navigate } from "@/lib/navigation";
import { getErrorMessage } from "@/lib/get-error-message";
import { useProposeMatchMutation, type MatchFormat } from "./matchesApi";

/** Joueur défié : seuls l'id et le nom sont nécessaires. */
export interface ChallengeOpponent {
  id: string;
  displayname: string;
}

/** [Minor · Stats et historique] Bouton + dialogue pour défier un joueur au babyfoot (1v1 ou 2v2) : utilisé depuis le classement et depuis le chat. */
export function ChallengeDialog({
  opponent,
  children,
}: {
  opponent: ChallengeOpponent;
  children: React.ReactElement;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<MatchFormat>("ONE_V_ONE");
  const [teammateId, setTeammateId] = useState("");
  const [propose, { isLoading }] = useProposeMatchMutation();

  /** [Minor · Stats et historique] Envoie le défi (1v1 ou 2v2 avec coéquipier) à l'adversaire, ferme la boîte et confirme par un toast. */
  const submit = async () => {
    if (format === "TWO_V_TWO" && !teammateId) return;
    try {
      await propose({
        opponentId: opponent.id,
        format,
        teammateId: format === "TWO_V_TWO" ? teammateId : undefined,
      }).unwrap();
      setOpen(false);
      setFormat("ONE_V_ONE");
      setTeammateId("");
      toast.add({
        title: t("matches.challengeSentToast", { name: opponent.displayname }),
        type: "success",
        actionProps: {
          children: t("matches.myChallengesLink"),
          onClick: () => navigate(ROUTES.CHALLENGES),
        },
      });
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
            {t("matches.challengeTitle", { name: opponent.displayname })}
          </Dialog.Title>
          <RadioGroup
            value={format}
            onValueChange={(value) => setFormat(value as MatchFormat)}
            className="mt-4 flex flex-col gap-2"
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
          {format === "TWO_V_TWO" ? (
            <div className="mt-4">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {t("matches.pickTeammateTitle")}
              </p>
              <FriendPicker
                value={teammateId}
                onChange={setTeammateId}
                excludeIds={[opponent.id]}
              />
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
              loading={isLoading} disabled={(format === "TWO_V_TWO" && !teammateId)}
              onClick={() => void submit()}
            >
              {t("matches.sendChallenge")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
