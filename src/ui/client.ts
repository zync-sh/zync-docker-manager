import type { ZyncPaneApi } from "@zync-sh/plugin-sdk/pane";
import type { Query } from "../domain/protocol";
import type { DockerClient, Connection } from "../domain/types";
import { requestTimeout } from "../domain/requestTimeout";
export type { DockerClient } from "../domain/types";
export class RequestError extends Error {
  constructor(
    message: string,
    public code = "failed",
  ) {
    super(message);
  }
}

export function createHostClient(api: ZyncPaneApi): DockerClient {
  const frameId = crypto.randomUUID();
  let sequence = 0,
    queued = 0;
  let disposed = false;
  let tail: Promise<unknown> = Promise.resolve();
  const pending = new Map<
    string,
    {
      resolve(value: unknown): void;
      reject(error: Error): void;
      text: string;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const unsubscribe = api.pane.onMessage((message) => {
    if (!message || typeof message !== "object") return;
    const data = message as {
      requestId?: string;
      chunk?: string;
      done?: boolean;
      error?: string;
      code?: string;
    };
    if (!data.requestId) return;
    const entry = pending.get(data.requestId);
    if (!entry) return;
    if (
      typeof data.chunk === "string" &&
      entry.text.length + data.chunk.length <= 512 * 1024
    ) {
      entry.text += data.chunk;
      return;
    }
    pending.delete(data.requestId);
    clearTimeout(entry.timer);
    if (data.error) entry.reject(new RequestError(data.error, data.code));
    else if (data.done) {
      try {
        entry.resolve(JSON.parse(entry.text));
      } catch {
        entry.reject(new RequestError("Invalid Docker response."));
      }
    } else
      entry.reject(new RequestError("Docker response exceeds its size limit."));
  });
  function request<T>(query: Query): Promise<T> {
    if (disposed) return Promise.reject(new RequestError("Pane closed."));
    if (queued >= 8)
      return Promise.reject(
        new RequestError("Please wait for current operations.", "busy"),
      );
    queued += 1;
    const operation = tail
      .catch(() => {})
      .then(
        () =>
          new Promise<T>((resolve, reject) => {
            if (disposed) {
              reject(new RequestError("Pane closed."));
              return;
            }
            const requestId = `${frameId}-${++sequence}`;
            const timer = setTimeout(() => {
              try {
                api.pane.postMessage({ type: "cancel", requestId });
              } catch {}
              pending.delete(requestId);
              reject(
                new RequestError(
                  "Operation timed out. Its outcome may be unknown; refresh before retrying.",
                ),
              );
            }, requestTimeout(query.type));
            pending.set(requestId, {
              resolve: (value) => resolve(value as T),
              reject,
              timer,
              text: "",
            });
            try {
              api.pane.postMessage({
                ...query,
                requestId,
                deadlineAt: Date.now() + requestTimeout(query.type),
              });
            } catch (error) {
              clearTimeout(timer);
              pending.delete(requestId);
              reject(error);
            }
          }),
      )
      .finally(() => {
        queued -= 1;
      });
    tail = operation;
    return operation;
  }
  const identity = (context: Connection): Connection => ({
    connectionToken: context.connectionToken,
    daemonId: context.daemonId,
  });
  return {
    snapshot: () => request({ type: "snapshot" }),
    metrics: (context) => request({ type: "metrics", ...identity(context) }),
    inspect: (id, context) =>
      request({ type: "inspect", id, ...identity(context) }),
    logs: (id, context) => request({ type: "logs", id, ...identity(context) }),
    resources: (section, context) =>
      request({ type: "resources", section, ...identity(context) }),
    action: (action, ids, context) =>
      request({ type: "action", action, ids, ...identity(context) }),
    exec: (id, input, context, shell = "sh") =>
      request({ type: "exec", id, input, shell, ...identity(context) }),
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      pending.forEach((entry, requestId) => {
        try {
          api.pane.postMessage({ type: "cancel", requestId });
        } catch {}
        clearTimeout(entry.timer);
        entry.reject(new RequestError("Pane closed."));
      });
      pending.clear();
    },
  };
}
