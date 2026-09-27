export function requestTimeout(type: string): number {
  return type === "action" || type === "exec" ? 300_000 : 90_000;
}
