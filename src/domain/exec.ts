import { containerId } from "./docker";
export type Shell = "sh" | "bash";
export function validateExecInput(input: unknown): string {
  if (
    typeof input !== "string" ||
    !input.trim() ||
    input.length > 1000 ||
    /[\x00-\x1f\x7f]/.test(input)
  )
    throw new Error("Enter a single-line command of up to 1000 characters.");
  return input;
}
export function containerShell(shell: Shell): string {
  return shell === "bash" ? "/bin/bash" : "/bin/sh";
}
export function interactiveCommand(id: string, shell: Shell): string {
  return `docker exec -it ${containerId(id)} ${containerShell(shell)}`;
}
