type ToastListener = (message: string) => void;

const listeners = new Set<ToastListener>();

export function toast(message: string) {
  for (const listener of listeners) {
    listener(message);
  }
}

export function subscribeToast(listener: ToastListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
