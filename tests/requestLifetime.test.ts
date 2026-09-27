import assert from "node:assert/strict";
import { test } from "node:test";
import type { ZyncWorkerApi } from "@zync-sh/plugin-sdk/worker";
import { createRequestScheduler } from "../src/worker/requestScheduler";
import {
  createRequestApi,
  requestDeadline,
} from "../src/worker/requestLifetime";

const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture() {
  let commands = 0;
  let approve: (value: boolean) => void = () => {};
  const api = {
    sshCommand: {
      execute: async () => {
        commands++;
        return {
          stdout: "",
          stderr: "",
          exitCode: 0,
          connectionToken: "token",
        };
      },
    },
    ui: {
      confirm: () =>
        new Promise<boolean>((resolve) => {
          approve = resolve;
        }),
    },
  } as unknown as ZyncWorkerApi;
  return {
    api,
    commands: () => commands,
    approve: (value: boolean) => approve(value),
  };
}

test("expired queued commands are not dispatched", async () => {
  let now = 0;
  const schedule = createRequestScheduler(0, {
    now: () => now,
    wait: async () => {},
  });
  let release = () => {};
  const blocker = schedule(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await tick();
  const host = fixture();
  const api = createRequestApi(
    host.api,
    schedule,
    100,
    new AbortController().signal,
    () => now,
  );
  const operation = api.sshCommand.execute("pane", {
    program: "docker",
    args: ["stop", "id"],
  });
  const rejected = assert.rejects(operation, /expired/);
  now = 101;
  release();
  await blocker;
  await rejected;
  assert.equal(host.commands(), 0);
});

test("approval waiting does not block other panes and canceled approval cannot continue", async () => {
  const schedule = createRequestScheduler(0);
  const host = fixture();
  const controller = new AbortController();
  const api = createRequestApi(
    host.api,
    schedule,
    Date.now() + 10000,
    controller.signal,
  );
  const approval = api.ui.confirm({ title: "Stop?", message: "Confirm" });
  const rejected = assert.rejects(approval, /expired|canceled/);
  await tick();
  const other = createRequestApi(
    host.api,
    schedule,
    Date.now() + 10000,
    new AbortController().signal,
  );
  await other.sshCommand.execute("other", {
    program: "docker",
    args: ["info"],
  });
  assert.equal(host.commands(), 1);
  controller.abort();
  await rejected;
  host.approve(true);
  await assert.rejects(
    api.sshCommand.execute("pane", { program: "docker", args: ["stop", "id"] }),
    /expired|canceled/,
  );
  assert.equal(host.commands(), 1);
});

test("deadlines reject malformed values and cap client-supplied lifetimes", () => {
  assert.throws(
    () => requestDeadline({ deadlineAt: "never" }, "exec", 0),
    /Invalid/,
  );
  assert.throws(
    () => requestDeadline({ deadlineAt: Infinity }, "exec", 0),
    /Invalid/,
  );
  assert.equal(requestDeadline({ deadlineAt: 999999 }, "exec", 0), 300000);
  assert.equal(requestDeadline({ deadlineAt: 100 }, "exec", 0), 100);
});
