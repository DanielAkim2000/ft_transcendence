export const logger = (
  message: unknown,
  level: "info" | "error" | "warn" | "debug" = "info",
) => {
  // import.meta.env.DEV (et non NODE_ENV, que Vite n'expose pas) : false une
  // fois buildé en production, donc rien n'atteint la console en éval.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- seul point du front autorisé à toucher la console, et seulement en dev.
    console[level](`[${new Date().toISOString()}] ${JSON.stringify(message)}`);
  }
};
