import { useEffect, useState } from "react";
import { subscribeToast } from "@/lib/toast";

export function AppToaster() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToast((next) => {
      setMessage(next);
    });
  }, []);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(null), 2800);
    return () => window.clearTimeout(id);
  }, [message]);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <p
        role="status"
        className="pointer-events-auto rounded-lg border border-border bg-card px-4 py-2 font-sans text-sm text-card-foreground shadow-md"
      >
        {message}
      </p>
    </div>
  );
}
