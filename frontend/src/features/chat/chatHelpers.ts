import type { Conversation } from "@/features/chat/chatApi";

/** [Major · Interaction entre utilisateurs] Heure locale (HH:MM) d'un message. */
export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** [Major · Interaction entre utilisateurs] Identifiant de l'autre participant d'une conversation. */
export const otherUserId = (conversation: Conversation, meId?: string) =>
  conversation.userAId === meId ? conversation.userBId : conversation.userAId;
