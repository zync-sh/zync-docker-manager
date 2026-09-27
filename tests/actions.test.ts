import assert from "node:assert/strict";
import { test } from "node:test";
import type { ActionResult, DockerClient } from "../src/domain/types";
import { runContainerAction } from "../src/ui/runContainerAction";

const context = { connectionToken: "connection", daemonId: "daemon" };

test("transport failures retain completed batches and never retry", async () => {
  let calls = 0;
  const result = await runContainerAction(
    clientFor(async (_, ids) => {
      if (++calls === 2) throw new Error("Connection lost");
      return { canceled: false, completed: ids };
    }),
    "restart",
    Array.from({ length: 12 }, (_, i) => String(i)),
    context,
    () => {},
  );
  assert.equal(calls, 2);
  assert.equal(result.completed.length, 5);
  assert.match(result.failed!, /uncertain outcome/);
});

function clientFor(action: DockerClient["action"]) {
  return { action } as DockerClient;
}

test("whole selections are deduplicated and confirmed in sequential batches", async () => {
  const batches: string[][] = [];
  const targets = Array.from({ length: 12 }, (_, i) => String(i));
  const result = await runContainerAction(
    clientFor(async (_, ids, identity) => {
      assert.equal(identity, context);
      batches.push(ids);
      return { canceled: false, completed: ids };
    }),
    "stop",
    [...targets, "0"],
    context,
    () => {},
  );
  assert.deepEqual(
    batches.map((ids) => ids.length),
    [5, 5, 2],
  );
  assert.deepEqual(result.completed, targets);
});

for (const interruption of [
  { canceled: true, completed: [] },
  { canceled: false, completed: ["5"], failed: "Failed" },
] satisfies ActionResult[]) {
  test(`remaining batches stop on ${interruption.canceled ? "cancellation" : "failure"}`, async () => {
    let calls = 0;
    const result = await runContainerAction(
      clientFor(async (_, ids) => {
        calls++;
        return calls === 1 ? { canceled: false, completed: ids } : interruption;
      }),
      "remove",
      Array.from({ length: 12 }, (_, i) => String(i)),
      context,
      () => {},
    );
    assert.equal(calls, 2);
    assert.equal(result.completed.length, 5 + interruption.completed.length);
    assert.equal(result.canceled, interruption.canceled);
    assert.equal(result.failed, interruption.failed);
  });
}
