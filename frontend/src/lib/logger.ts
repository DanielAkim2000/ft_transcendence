export const logger = (
  message: unknown,
  level: "info" | "error" | "warn" | "debug" = "info",
) => {
  if (import.meta.env.NODE_ENV === "development") {
    console[level](`[${new Date().toISOString()}] ${JSON.stringify(message)}`);
  }
};
