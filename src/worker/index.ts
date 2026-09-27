import type { ZyncWorkerApi } from "@zync-sh/plugin-sdk/worker";
import { parseQuery } from "../domain/protocol";
import { DockerError, queryDocker } from "./service";
import { errorMessage } from "../domain/errors";
declare const zync: ZyncWorkerApi;
const busy = new Set<string>();
zync.on("ready", async () => {
  await zync.panel.register("docker.manager");
});
zync.panel.onMessage(({ paneInstanceId, message }) => {
  void handle(paneInstanceId, message).catch(() => {});
});

async function handle(paneId: string, message: unknown): Promise<void> {
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
  try {
    const serialized = JSON.stringify(await queryDocker(zync, paneId, request));
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
    busy.delete(paneId);
  }
}
