import type { ZyncWorkerApi } from "@zync-sh/plugin-sdk/worker";
import { parseQuery } from "../domain/protocol";
import { DockerError, queryDocker } from "./service";
import { errorMessage } from "../domain/errors";
import { createRequestScheduler } from "./requestScheduler";
import { createRequestApi, requestDeadline } from "./requestLifetime";
declare const zync: ZyncWorkerApi;
const busy = new Set<string>();
const schedule = createRequestScheduler();
const active = new Map<
  string,
  { requestId: string; controller: AbortController }
>();
zync.on("ready", async () => {
  await zync.panel.register("docker.manager");
});
zync.panel.onMessage(({ paneInstanceId, message }) => {
  void handle(paneInstanceId, message).catch(() => {});
});

async function handle(paneId: string, message: unknown): Promise<void> {
  if (
    message &&
    typeof message === "object" &&
    (message as { type?: unknown }).type === "cancel"
  ) {
    const current = active.get(paneId);
    if (current?.requestId === (message as { requestId?: unknown }).requestId)
      current?.controller.abort();
    return;
  }
  let request;
  try {
    request = parseQuery(message);
  } catch {
    return;
  }
  const reply = (payload: object) =>
    zync.panel.postMessage(paneId, {
      requestId: request.requestId,
      ...payload,
    });
  if (busy.has(paneId)) {
    await reply({
      error: "Another operation is running. Please wait.",
      code: "busy",
    });
    return;
  }
  busy.add(paneId);
  const controller = new AbortController();
  active.set(paneId, { requestId: request.requestId, controller });
  let expiry: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = requestDeadline(message, request.type);
    expiry = setTimeout(
      () => controller.abort(),
      Math.max(0, deadline - Date.now()),
    );
    const dockerApi = createRequestApi(
      zync,
      schedule,
      deadline,
      controller.signal,
    );
    const serialized = JSON.stringify(
      await queryDocker(dockerApi, paneId, request),
    );
    if (serialized.length > 512 * 1024)
      throw new Error("Docker result is too large to display.");
    for (let offset = 0; offset < serialized.length; offset += 8000) {
      if (!(await reply({ chunk: serialized.slice(offset, offset + 8000) })))
        return;
    }
    await reply({ done: true });
  } catch (error) {
    const message = errorMessage(error);
    await reply({
      error: message.slice(0, 1500),
      code:
        error instanceof DockerError
          ? error.code
          : /permission|denied|grant|capability/i.test(message)
            ? "permission"
            : /connection|token|SSH|disconnected|not.ready/i.test(message)
              ? "disconnected"
              : "failed",
    });
  } finally {
    clearTimeout(expiry);
    active.delete(paneId);
    busy.delete(paneId);
  }
}
