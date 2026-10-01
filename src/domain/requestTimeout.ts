export function requestTimeout(type: string): number {
  return type === "action" || type === "terminal" ? 300_000 : 90_000;
}
