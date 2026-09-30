import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftIcon,
  Check,
  CheckCheck,
  CrownIcon,
  SwordsIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { ChallengeDialog } from "@/features/matches/ChallengeDialog";
import { useChessInvite } from "@/features/chess/useChessInvite";
import { ROUTES } from "@/constants/routes";
import { useMeQuery } from "@/features/auth/authApi";
import { useGetUserQuery } from "@/features/users/usersApi";
import {
  MESSAGES_PAGE_SIZE,
  useBlockUserMutation,
  useCreateConversationMutation,
  useGetMessagesQuery,
  useIsBlockedQuery,
  useListConversationsQuery,
  useMarkConversationReadMutation,
  useSendMessageMutation,
  useUnblockUserMutation,
  type Conversation,
  type Message,
} from "@/features/chat/chatApi";
import { setActiveConversation } from "@/features/chat/activeConversation";
import { emitTyping } from "@/features/chat/chatSocket";
import { onTypingEvent } from "@/features/chat/typingIndicator";
import { getErrorMessage } from "@/lib/get-error-message";
import { getInitials, resolveAvatarUrl } from "@/lib/user";
import { cn } from "@/lib/utils";
import { RowSkeleton } from "@/components/skeletons";

const TYPING_STOP_DELAY_MS = 1500;
const TYPING_EXPIRE_MS = 3000;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const otherUserId = (conversation: Conversation, meId?: string) =>
  conversation.userAId === meId ? conversation.userBId : conversation.userAId;

const isReadByPeer = (message: Message, conversation: Conversation) =>
  Boolean(conversation.peerLastReadAt) &&
  new Date(message.createdAt).getTime() <=
    new Date(conversation.peerLastReadAt as string).getTime();

function PeerAvatar({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const { data } = useGetUserQuery(userId);
  const user = data?.user;
  return (
    <Avatar className={cn("size-8 rounded-none", className)}>
      <AvatarImage
        src={resolveAvatarUrl(user?.avatarUrl)}
        alt={user?.displayname}
        className="rounded-none"
      />
      <AvatarFallback className="rounded-none text-xs">
        {getInitials(user?.displayname)}
      </AvatarFallback>
    </Avatar>
  );
}

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
              ? `${last.senderId === meId ? `${t("chat.you")}: ` : ""}${last.content}`
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

function Thread({
  conversation,
  meId,
  onBack,
}: {
  conversation: Conversation;
  meId?: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const peerId = otherUserId(conversation, meId);
  const { data: peer } = useGetUserQuery(peerId);
  const { data: blockStatus } = useIsBlockedQuery(peerId);
  const [cursor, setCursor] = useState<string | undefined>();
  const [exhausted, setExhausted] = useState(false);
  const lengthBeforeLoadMore = useRef(0);
  const { data: messages = [], isFetching } = useGetMessagesQuery({
    conversationId: conversation.id,
    cursor,
  });
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();
  const [markRead] = useMarkConversationReadMutation();
  const [blockUser, { isLoading: blocking }] = useBlockUserMutation();
  const [unblockUser, { isLoading: unblocking }] = useUnblockUserMutation();
  const { inviteToChess } = useChessInvite();
  const [draft, setDraft] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const peerTypingExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const stopTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const endRef = useRef<HTMLDivElement>(null);

  const isBlockedByMe = blockStatus?.blocked ?? false;
  const newestId = messages[0]?.id;
  const ordered = useMemo(() => [...messages].reverse(), [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [newestId]);

  useEffect(() => {
    setActiveConversation(conversation.id);
    return () => setActiveConversation(null);
  }, [conversation.id]);

  useEffect(() => {
    const unsubscribe = onTypingEvent((event) => {
      if (event.conversationId !== conversation.id || event.userId !== peerId) {
        return;
      }
      if (peerTypingExpiryRef.current)
        clearTimeout(peerTypingExpiryRef.current);
      if (event.isTyping) {
        setPeerTyping(true);
        peerTypingExpiryRef.current = setTimeout(
          () => setPeerTyping(false),
          TYPING_EXPIRE_MS,
        );
      } else {
        setPeerTyping(false);
      }
    });
    return () => {
      unsubscribe();
      if (peerTypingExpiryRef.current)
        clearTimeout(peerTypingExpiryRef.current);
    };
  }, [conversation.id, peerId]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    emitTyping(conversation.id, true);
    if (stopTypingTimeoutRef.current)
      clearTimeout(stopTypingTimeoutRef.current);
    stopTypingTimeoutRef.current = setTimeout(
      () => emitTyping(conversation.id, false),
      TYPING_STOP_DELAY_MS,
    );
  };

  const newestFromPeer = messages[0] ? messages[0].senderId !== meId : false;
  useEffect(() => {
    if (conversation.unreadCount > 0 || newestFromPeer) {
      void markRead(conversation.id);
    }
  }, [
    conversation.id,
    conversation.unreadCount,
    newestId,
    newestFromPeer,
    markRead,
  ]);

  useEffect(() => {
    if (
      !isFetching &&
      cursor &&
      messages.length === lengthBeforeLoadMore.current
    ) {
      setExhausted(true);
    }
  }, [isFetching, cursor, messages.length]);

  const loadOlder = () => {
    lengthBeforeLoadMore.current = messages.length;
    setCursor(messages[messages.length - 1]?.id);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    if (stopTypingTimeoutRef.current)
      clearTimeout(stopTypingTimeoutRef.current);
    emitTyping(conversation.id, false);
    try {
      await sendMessage({ conversationId: conversation.id, content }).unwrap();
      setDraft("");
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("chat.sendFailed")),
        type: "error",
      });
    }
  };

  const toggleBlock = async () => {
    try {
      if (isBlockedByMe) {
        await unblockUser(peerId).unwrap();
        toast.add({ title: t("chat.unblockedToast"), type: "success" });
      } else {
        await blockUser(peerId).unwrap();
        toast.add({ title: t("chat.blockedToast"), type: "success" });
      }
    } catch (error) {
      toast.add({
        title: getErrorMessage(error, t("chat.actionFailed")),
        type: "error",
      });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={onBack}
          aria-label={t("chat.back")}
        >
          <ArrowLeftIcon />
        </Button>
        <Link
          to={ROUTES.profile(peerId)}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <PeerAvatar userId={peerId} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold hover:underline">
              {peer?.user.displayname ?? "…"}
            </p>
            {peerTyping ? (
              <p className="text-[11px] uppercase tracking-wider text-primary">
                {t("chat.typing")}
              </p>
            ) : peer?.user.isOnline !== undefined &&
              peer.friendshipStatus === "friends" ? (
              <p
                className={cn(
                  "text-[11px] uppercase tracking-wider",
                  peer.user.isOnline ? "text-primary" : "text-muted-foreground",
                )}
              >
                {peer.user.isOnline
                  ? t("profile.online")
                  : t("profile.offline")}
              </p>
            ) : null}
          </div>
        </Link>
        {peer && !isBlockedByMe ? (
          <>
            <ChallengeDialog opponent={peer.user}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={t("matches.challenge")}
              >
                <SwordsIcon />
                <span className="hidden sm:inline">
                  {t("matches.challenge")}
                </span>
              </Button>
            </ChallengeDialog>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={t("chat.inviteChess")}
              onClick={() => inviteToChess(peerId)}
            >
              <CrownIcon />
              <span className="hidden sm:inline">{t("chat.inviteChess")}</span>
            </Button>
          </>
        ) : null}
        {isBlockedByMe ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={unblocking}
            onClick={() => void toggleBlock()}
          >
            {t("chat.unblock")}
          </Button>
        ) : (
          <ConfirmDialog
            title={t("chat.blockTitle")}
            description={t("chat.blockDescription", {
              name: peer?.user.displayname ?? "",
            })}
            confirmLabel={t("chat.block")}
            loading={blocking}
            onConfirm={toggleBlock}
          >
            <Button type="button" size="sm" variant="outline">
              {t("chat.block")}
            </Button>
          </ConfirmDialog>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length >= MESSAGES_PAGE_SIZE && !exhausted ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-center text-xs"
            disabled={isFetching}
            onClick={loadOlder}
          >
            {t("chat.loadOlder")}
          </Button>
        ) : null}
        {ordered.length === 0 && !isFetching ? (
          <p className="m-auto text-sm text-muted-foreground">
            {t("chat.noMessages")}
          </p>
        ) : null}
        {ordered.map((message) => {
          const mine = message.senderId === meId;
          return (
            <div
              key={message.id}
              className={cn(
                "flex max-w-[85%] flex-col gap-1",
                mine && "items-end self-end",
              )}
            >
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {mine ? t("chat.you") : (peer?.user.displayname ?? "…")} ·{" "}
                {formatTime(message.createdAt)}
              </span>
              <p
                className={cn(
                  "border px-3 py-2 text-sm break-words whitespace-pre-wrap",
                  mine
                    ? "border-primary/60 bg-primary/10"
                    : "border-border bg-card",
                )}
              >
                {message.content}
              </p>
              {mine ? (
                <span
                  className="flex items-center gap-1 text-[10px] text-muted-foreground"
                  aria-label={
                    isReadByPeer(message, conversation)
                      ? t("chat.read")
                      : t("chat.sent")
                  }
                >
                  {isReadByPeer(message, conversation) ? (
                    <CheckCheck className="size-3 text-primary" />
                  ) : (
                    <Check className="size-3" />
                  )}
                </span>
              ) : null}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {isBlockedByMe ? (
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {t("chat.blockedNotice")}
        </p>
      ) : (
        <form
          onSubmit={(event) => void submit(event)}
          className="flex gap-2 border-t border-border p-3"
        >
          <Input
            value={draft}
            onChange={(event) => handleDraftChange(event.target.value)}
            placeholder={t("chat.placeholder")}
            maxLength={1000}
            autoComplete="off"
          />
          <Button type="submit" disabled={sending || !draft.trim()}>
            {t("chat.send")}
          </Button>
        </form>
      )}
    </div>
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
          <Thread
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
