import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/toast";
import { messagePreview } from "@/features/chat/messagePreview";
import { useMeQuery } from "@/features/auth/authApi";
import { useGetUserQuery } from "@/features/users/usersApi";
import {
  useCreateConversationMutation,
  useListConversationsQuery,
  type Conversation,
} from "@/features/chat/chatApi";
import { ChatThread, PeerAvatar } from "@/features/chat/ChatThread";
import { formatTime, otherUserId } from "@/features/chat/chatHelpers";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import { RowSkeleton } from "@/components/skeletons";

function ConversationRow({
  conversation,
  meId,
  active,
  onSelect,
}: {
  conversation: Conversation;
  meId?: string;
  active: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const peerId = otherUserId(conversation, meId);
  const { data } = useGetUserQuery(peerId);
  const last = conversation.lastMessage;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors hover:bg-accent",
          active ? "border-primary bg-accent" : "border-transparent",
        )}
      >
        <PeerAvatar userId={peerId} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm",
                conversation.unreadCount > 0 ? "font-bold" : "font-medium",
              )}
            >
              {data?.user.displayname ?? "…"}
            </span>
            {last ? (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatTime(last.createdAt)}
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              "truncate text-xs",
              conversation.unreadCount > 0
                ? "font-semibold text-foreground"
                : "text-muted-foreground",
            )}
          >
            {last
              ? `${last.senderId === meId ? `${t("chat.you")}: ` : ""}${messagePreview(last, t)}`
              : t("chat.noMessages")}
          </p>
        </div>
        {conversation.unreadCount > 0 ? (
          <span
            className="flex size-5 shrink-0 items-center justify-center bg-primary text-[10px] font-bold text-primary-foreground"
            aria-label={t("chat.unread", { count: conversation.unreadCount })}
          >
            {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
          </span>
        ) : null}
      </button>
    </li>
  );
}

export const Chat = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: me } = useMeQuery();
  const { data: conversations = [], isLoading } = useListConversationsQuery();
  const [createConversation] = useCreateConversationMutation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const openedFor = useRef<string | null>(null);

  const targetUserId = searchParams.get("user");

  useEffect(() => {
    if (!targetUserId || openedFor.current === targetUserId) return;
    openedFor.current = targetUserId;
    createConversation({ otherUserId: targetUserId })
      .unwrap()
      .then((conversation) => setSelectedId(conversation.id))
      .catch((error) =>
        toast.add({
          title: getErrorMessage(error, t("chat.openFailed")),
          type: "error",
        }),
      )
      .finally(() => setSearchParams({}, { replace: true }));
  }, [targetUserId, createConversation, setSearchParams, t]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-0 border border-border bg-card">
      <aside
        className={cn(
          "w-full shrink-0 flex-col border-border md:flex md:w-80 md:border-r",
          selected ? "hidden" : "flex",
        )}
      >
        <h1 className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("chat.conversations")}
        </h1>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <>
              <li className="sr-only" role="status">
                {t("common.loading")}
              </li>
              {Array.from({ length: 6 }, (_, index) => (
                <RowSkeleton key={index} index={index} variant="flush" />
              ))}
            </>
          ) : conversations.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              {t("chat.noConversations")}
            </li>
          ) : (
            conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                meId={me?.id}
                active={conversation.id === selectedId}
                onSelect={() => setSelectedId(conversation.id)}
              />
            ))
          )}
        </ul>
      </aside>

      <section
        className={cn("min-w-0 flex-1", selected ? "block" : "hidden md:block")}
      >
        {selected ? (
          <ChatThread
            key={selected.id}
            conversation={selected}
            meId={me?.id}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t("chat.selectPrompt")}
          </p>
        )}
      </section>
    </div>
  );
};
