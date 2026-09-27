/** Host RPC failures can be strings rather than Error objects. */
export function errorMessage(
  error: unknown,
  fallback = "Docker operation failed.",
): string {
  if (typeof error === "string" && error.trim()) return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  )
    return error.message;
  return fallback;
}
