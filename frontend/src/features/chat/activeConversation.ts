let activeConversationId: string | null = null;

export const setActiveConversation = (id: string | null) => {
  activeConversationId = id;
};

export const getActiveConversation = () => activeConversationId;
