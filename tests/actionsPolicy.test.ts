import assert from "node:assert/strict";
import { test } from "node:test";
import { allowsAction, primaryAction } from "../src/domain/actions";

test("restarting containers offer stop, while paused containers never offer enabled start", () => {
  assert.equal(primaryAction("restarting"), "stop");
  assert.equal(allowsAction("stop", "restarting"), true);
  assert.equal(allowsAction("start", "paused"), false);
  assert.equal(allowsAction("restart", "paused"), false);
  assert.equal(allowsAction("remove", "running"), false);
  assert.equal(allowsAction("start", "exited"), true);
  assert.equal(allowsAction("remove", "exited"), true);
});
