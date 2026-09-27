import type { Action } from "./types";

export function allowsAction(action: Action, state: string): boolean {
  const stopped = ["exited", "created", "dead"].includes(state);
  if (action === "start" || action === "remove") return stopped;
  return ["running", "restarting"].includes(state);
}

export function primaryAction(state: string): "start" | "stop" {
  return ["running", "restarting"].includes(state) ? "stop" : "start";
}
