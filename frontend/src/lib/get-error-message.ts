export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data: unknown }).data;
    if (typeof data === "object" && data !== null && "message" in data) {
      const message = (data as { message: string | string[] }).message;
      return Array.isArray(message) ? message.join(", ") : message;
    }
  }
  return fallback;
}
