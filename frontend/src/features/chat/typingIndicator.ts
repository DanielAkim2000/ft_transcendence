export interface TypingEvent {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

type Listener = (event: TypingEvent) => void;

const listeners = new Set<Listener>();

export const onTypingEvent = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const emitTypingEvent = (event: TypingEvent) => {
  listeners.forEach((listener) => listener(event));
};
