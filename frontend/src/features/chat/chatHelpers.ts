import type { Conversation } from "@/features/chat/chatApi";

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export const otherUserId = (conversation: Conversation, meId?: string) =>
  conversation.userAId === meId ? conversation.userBId : conversation.userAId;
