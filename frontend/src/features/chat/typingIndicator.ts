export interface TypingEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

type Listener = (event: TypingEvent) => void;

const listeners = new Set<Listener>();

/** [Minor · Chat avancé] S'abonne aux événements « en train d'écrire » ; renvoie la fonction de désabonnement. */
export const onTypingEvent = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** [Minor · Chat avancé] Diffuse un événement « en train d'écrire » à tous les abonnés. */
export const emitTypingEvent = (event: TypingEvent) => {
  listeners.forEach((listener) => listener(event));
};
