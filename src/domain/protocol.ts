import { containerId, record } from "./docker";
import type { Action, Connection, Section } from "./types";
import type { Shell } from "./exec";
export type Request = (
  | { type: "snapshot" }
  | ((
      | { type: "metrics" }
      | { type: "inspect"; id: string }
      | { type: "logs"; id: string }
      | { type: "resources"; section: Exclude<Section, "containers"> }
      | { type: "action"; action: Action; ids: string[] }
      | { type: "terminal"; id: string; shell: Shell }
    ) &
      Connection)
) & { requestId: string };
export type Query = Request extends infer R
  ? R extends Request
    ? Omit<R, "requestId">
    : never
  : never;

export function parseQuery(message: unknown): Request {
  const data = record(message);
  if (
    typeof data.requestId !== "string" ||
    !/^[a-zA-Z0-9-]{1,96}$/.test(data.requestId)
  )
    throw new Error("Invalid request ID.");
  const requestId = data.requestId;
  if (data.type === "snapshot") return { type: "snapshot", requestId };
  if (
    typeof data.connectionToken !== "string" ||
    !data.connectionToken ||
    data.connectionToken.length > 512 ||
    typeof data.daemonId !== "string" ||
    !data.daemonId ||
    data.daemonId.length > 256
  )
    throw new Error("Refresh this pane before operating on Docker.");
  const context = {
    connectionToken: data.connectionToken,
    daemonId: data.daemonId,
    requestId,
  };
  if (data.type === "metrics") return { ...context, type: "metrics" };
  if (data.type === "inspect" || data.type === "logs")
    return { ...context, type: data.type, id: containerId(data.id) };
  if (
    data.type === "resources" &&
    ["images", "volumes", "networks"].includes(String(data.section))
  )
    return {
      ...context,
      type: "resources",
      section: data.section as Exclude<Section, "containers">,
    };
  if (data.type === "action") {
    if (
      !["start", "stop", "restart", "remove"].includes(String(data.action)) ||
      !Array.isArray(data.ids) ||
      !data.ids.length ||
      data.ids.length > 5
    )
      throw new Error("Choose one to five containers.");
    const ids = data.ids.map(containerId);
    if (new Set(ids).size !== ids.length)
      throw new Error("Duplicate container selection.");
    return { ...context, type: "action", action: data.action as Action, ids };
  }
  if (data.type === "terminal") {
    if (
      data.shell !== undefined &&
      data.shell !== "sh" &&
      data.shell !== "bash"
    )
      throw new Error("Choose sh or bash.");
    const allowed = new Set([
      "type",
      "requestId",
      "deadlineAt",
      "id",
      "shell",
      "connectionToken",
      "daemonId",
    ]);
    if (Object.keys(data).some((key) => !allowed.has(key)))
      throw new Error("Unsupported terminal proposal field.");
    return {
      ...context,
      type: "terminal",
      id: containerId(data.id),
      shell: data.shell === "bash" ? "bash" : "sh",
    };
  }
  throw new Error("Unsupported Docker operation.");
}
