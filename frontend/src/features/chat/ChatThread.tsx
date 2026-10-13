import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
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
import { ChessInviteCard } from "@/features/chess/ChessInviteCard";
import { ROUTES } from "@/constants/routes";
import { useGetUserQuery } from "@/features/users/usersApi";
import {
  MESSAGES_PAGE_SIZE,
  useBlockUserMutation,
  useGetMessagesQuery,
  useIsBlockedQuery,
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
import { formatTime, otherUserId } from "@/features/chat/chatHelpers";

const TYPING_STOP_DELAY_MS = 1500;
const TYPING_EXPIRE_MS = 3000;

const isReadByPeer = (message: Message, conversation: Conversation) =>
  Boolean(conversation.peerLastReadAt) &&
  new Date(message.createdAt).getTime() <=
    new Date(conversation.peerLastReadAt as string).getTime();

export function PeerAvatar({
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

/** Fil de discussion d'une conversation. `embedded` : version compacte (sans retour ni défi), pour l'afficher à côté d'une partie. */
export function ChatThread({
  conversation,
  meId,
  onBack,
  embedded = false,
}: {
  conversation: Conversation;
  meId?: string;
  onBack?: () => void;
  embedded?: boolean;
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
  const { inviteToChess, inviting } = useChessInvite();
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
        {embedded ? null : (
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
        )}
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
        {peer && !isBlockedByMe && !embedded ? (
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
              loading={inviting}
              onClick={() => void inviteToChess(peerId)}
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
            loading={unblocking}
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
            loading={isFetching}
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
              {message.chessGameId ? (
                <ChessInviteCard
                  gameId={message.chessGameId}
                  meId={meId}
                  peerName={peer?.user.displayname ?? "…"}
                />
              ) : (
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
              )}
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
