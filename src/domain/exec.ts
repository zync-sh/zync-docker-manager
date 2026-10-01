import { containerId, record } from "./docker";
import type { TerminalResult } from "./types";
export type Shell = "sh" | "bash";
/** Validate the offer bridge before allocating a browser terminal slot. */
export function parseTerminalResult(value: unknown): TerminalResult {
  const result = record(value);
  if (result.supported === false) return { supported: false };
  if (
    result.supported !== true ||
    typeof result.offerId !== "string" ||
    !/^[a-zA-Z0-9-]{1,128}$/.test(result.offerId) ||
    typeof result.expiresInMs !== "number" ||
    !Number.isFinite(result.expiresInMs) ||
    result.expiresInMs <= 0 ||
    result.expiresInMs > 60000
  )
    throw new Error("Invalid terminal offer. Refresh before retrying.");
  return {
    supported: true,
    offerId: result.offerId,
    expiresInMs: result.expiresInMs,
  };
}
export function containerShell(shell: Shell): string {
  if (shell !== "sh" && shell !== "bash") throw new Error("Choose sh or bash.");
  return shell === "bash" ? "/bin/bash" : "/bin/sh";
}
/** Fixed argv proposal; interactive authority and user approval stay in Zync. */
export function containerTerminalLaunch(
  id: string,
  shell: Shell,
  token: string,
) {
  return {
    program: "docker",
    args: ["exec", "-it", containerId(id), containerShell(shell)],
    expectedConnectionToken: token,
  };
}
export function interactiveCommand(id: string, shell: Shell): string {
  return `docker exec -it ${containerId(id)} ${containerShell(shell)}`;
}
