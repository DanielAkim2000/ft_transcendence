let activeConversationId: string | null = null;

/** [Major · Interaction entre utilisateurs] Mémorise la conversation ouverte (pour ne pas compter ses messages comme non lus). */
export const setActiveConversation = (id: string | null) => {
  activeConversationId = id;
};

/** [Major · Interaction entre utilisateurs] Renvoie l'identifiant de la conversation actuellement ouverte. */
export const getActiveConversation = () => activeConversationId;
