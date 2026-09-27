import assert from "node:assert/strict";
import { test } from "node:test";
import { createHostClient } from "../src/ui/client";
const tick = () => new Promise((resolve) => setImmediate(resolve));
test("bridge serializes requests, assembles chunks and cleans up", async () => {
  let listener: (message: unknown) => void = () => {};
  const sent: Array<{ requestId: string; [key: string]: unknown }> = [];
  let unsubscribed = 0;
  const client = createHostClient({
    pane: {
      onMessage(callback) {
        listener = callback;
        return () => {
          unsubscribed++;
        };
      },
      postMessage(message) {
        sent.push(message as (typeof sent)[number]);
      },
    },
  });
  const first = client.snapshot();
  await tick();
  listener({ requestId: "unrelated", done: true });
  listener({ requestId: sent[0].requestId, chunk: '{"containers":' });
  listener({ requestId: sent[0].requestId, chunk: "[]}" });
  listener({ requestId: sent[0].requestId, done: true });
  assert.deepEqual(await first, { containers: [] });
  const context = {
    connectionToken: "token",
    daemonId: "daemon",
    containers: ["should not be sent"],
  };
  const second = client.logs("a".repeat(64), context);
  await tick();
  assert.equal("containers" in sent[1], false);
  const third = client.snapshot();
  await tick();
  assert.equal(sent.length, 2);
  const rejection = assert.rejects(second, /Pane closed/),
    queued = assert.rejects(third, /Pane closed/);
  client.dispose();
  client.dispose();
  await rejection;
  await queued;
  assert.equal(unsubscribed, 1);
  await assert.rejects(client.snapshot(), /Pane closed/);
});
test("malformed and oversized response chunks are rejected", async () => {
  let listener: (message: unknown) => void = () => {};
  let id = "";
  const client = createHostClient({
    pane: {
      onMessage(fn) {
        listener = fn;
        return () => {};
      },
      postMessage(message) {
        id = (message as { requestId: string }).requestId;
      },
    },
  });
  const first = client.snapshot();
  await tick();
  listener({ requestId: id, chunk: "x".repeat(512 * 1024 + 1) });
  await assert.rejects(first, /size limit/);
  const next = client.snapshot();
  await tick();
  listener({ requestId: id, chunk: "invalid" });
  listener({ requestId: id, done: true });
  await assert.rejects(next, /Invalid Docker response/);
  client.dispose();
});
