import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAccessToken } from "../auth/authSlice";
import { useMeQuery } from "../auth/authApi";
import { getActiveConversation } from "./activeConversation";
import { connect, disconnect } from "./chatSocket";
import {
  applyConversationReadToCache,
  applyMessageToCache,
  type Message,
} from "./chatApi";
import { emitTypingEvent, type TypingEvent } from "./typingIndicator";

export const ChatBootstrap = ({ children }: { children: React.ReactNode }) => {
  const accessToken = useAppSelector(selectAccessToken);
  const dispatch = useAppDispatch();
  const { data: me } = useMeQuery();
  const meId = me?.id;

  useEffect(() => {
    if (!accessToken) {
      disconnect();
      return;
    }
    const socket = connect(accessToken);
    const onNewMessage = (message: Message) =>
      applyMessageToCache(dispatch, message, {
        meId,
        activeConversationId: getActiveConversation(),
      });
    const onConversationRead = (payload: {
      conversationId: string;
      readerId: string;
      readAt: string;
    }) => applyConversationReadToCache(dispatch, payload, meId);
    const onTyping = (payload: TypingEvent) => emitTypingEvent(payload);
    socket.on("message:new", onNewMessage);
    socket.on("conversation:read", onConversationRead);
    socket.on("typing", onTyping);
    return () => {
      socket.off("message:new", onNewMessage);
      socket.off("conversation:read", onConversationRead);
      socket.off("typing", onTyping);
      disconnect();
    };
  }, [accessToken, dispatch, meId]);

  return <>{children}</>;
};
