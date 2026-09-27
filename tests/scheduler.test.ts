import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequestScheduler } from "../src/worker/requestScheduler";

test("shared scheduler spaces calls after completion and survives rejection", async () => {
  let now = 0;
  const starts: number[] = [];
  const schedule = createRequestScheduler(1000, {
    now: () => now,
    wait: async (delay) => {
      now += delay;
    },
  });
  const first = schedule(async () => {
    starts.push(now);
    now += 20000;
    return 1;
  });
  const second = schedule(async () => {
    starts.push(now);
    throw new Error("denied");
  });
  const rejected = assert.rejects(second, /denied/);
  const third = schedule(async () => {
    starts.push(now);
    return 3;
  });
  assert.equal(await first, 1);
  await rejected;
  assert.equal(await third, 3);
  assert.deepEqual(starts, [0, 21000, 22000]);
});
