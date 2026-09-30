import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Pagination } from "@/components/pagination";
import { useClampedPage } from "@/lib/use-clamped-page";
import { useListFriendsQuery } from "./usersApi";

const FRIEND_PICKER_PAGE_SIZE = 6;

type FriendPickerProps = {
  value: string;
  onChange: (friendId: string) => void;
  /** Amis à ne pas proposer (ex: l'adversaire ou un coéquipier déjà pris). */
  excludeIds?: string[];
};

/** Liste paginée (côté backend) d'amis à choisir, un seul à la fois. */
export function FriendPicker({
  value,
  onChange,
  excludeIds = [],
}: FriendPickerProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isFetching } = useListFriendsQuery({
    page,
    limit: FRIEND_PICKER_PAGE_SIZE,
  });
  useClampedPage(page, data?.totalPages, setPage);
  const friends = (data?.items ?? []).filter(
    (friend) => !excludeIds.includes(friend.id),
  );

  return (
    <div className="flex flex-col gap-3">
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="flex flex-col gap-2"
      >
        {friends.map((friend) => (
          <Label
            key={friend.id}
            className="flex items-center gap-2 border border-border p-2 text-sm"
          >
            <RadioGroupItem value={friend.id} />
            {friend.displayname}
          </Label>
        ))}
        {!isFetching && (data?.total ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("matches.noFriends")}
          </p>
        ) : null}
      </RadioGroup>
      <Pagination
        page={data?.page ?? page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
        disabled={isFetching}
      />
    </div>
  );
}
