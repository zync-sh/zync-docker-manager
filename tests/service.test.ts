import assert from "node:assert/strict";
import { test } from "node:test";
import type { ZyncWorkerApi } from "@zync-sh/plugin-sdk/worker";
import { queryDocker } from "../src/worker/service";
const id = "a".repeat(64),
  context = { connectionToken: "token", daemonId: "daemon", requestId: "r-1" };
function fixture({
  accept = true,
  state = "exited",
  changeDaemon = false,
  changeState = false,
}: {
  accept?: boolean;
  state?: string;
  changeDaemon?: boolean;
  changeState?: boolean;
} = {}) {
  const calls: Array<{
    program: string;
    args: string[];
    expectedConnectionToken?: string;
  }> = [];
  let confirmed = false;
  const api = {
    ui: {
      confirm: async () => {
        confirmed = true;
        return accept;
      },
    },
    sshCommand: {
      execute: async (pane: string, command: (typeof calls)[number]) => {
        assert.equal(pane, "pane");
        calls.push(command);
        let stdout = "";
        if (command.args[0] === "info")
          stdout = JSON.stringify({
            ID: confirmed && changeDaemon ? "other" : "daemon",
            Name: "server",
          });
        if (command.args[0] === "container")
          stdout = JSON.stringify([
            {
              Id: id,
              Name: "/api",
              Config: {},
              State: { Status: confirmed && changeState ? "running" : state },
            },
          ]);
        if (command.args[0] === "logs") stdout = "recent logs";
        return { exitCode: 0, stdout, stderr: "", connectionToken: "token" };
      },
    },
  } as unknown as ZyncWorkerApi;
  return { api, calls };
}
test("read operations retain pane and connection scope", async () => {
  const { api, calls } = fixture();
  const result = (await queryDocker(api, "pane", {
    ...context,
    type: "logs",
    id,
  })) as { text: string };
  assert.equal(result.text, "recent logs");
  assert.ok(
    calls.every(
      (c) => c.program === "docker" && c.expectedConnectionToken === "token",
    ),
  );
});
test("cancel never mutates Docker", async () => {
  const { api, calls } = fixture({ accept: false });
  assert.deepEqual(
    await queryDocker(api, "pane", {
      ...context,
      type: "action",
      action: "remove",
      ids: [id],
    }),
    { canceled: true, completed: [] },
  );
  assert.ok(!calls.some((c) => c.args[0] === "rm"));
});
test("remove rechecks identity and never forces deletion or removes volumes", async () => {
  const { api, calls } = fixture();
  await queryDocker(api, "pane", {
    ...context,
    type: "action",
    action: "remove",
    ids: [id],
  });
  assert.deepEqual(calls.at(-1)?.args, ["rm", id]);
  assert.equal(calls.filter((c) => c.args[0] === "info").length, 2);
});
test("daemon changes after confirmation fail closed", async () => {
  const { api, calls } = fixture({ changeDaemon: true });
  await assert.rejects(
    queryDocker(api, "pane", {
      ...context,
      type: "action",
      action: "start",
      ids: [id],
    }),
    /daemon changed/,
  );
  assert.ok(!calls.some((c) => c.args[0] === "start"));
});
test("state changes and running removal do not issue destructive commands", async () => {
  for (const options of [{ changeState: true }, { state: "running" }]) {
    const { api, calls } = fixture(options);
    await queryDocker(api, "pane", {
      ...context,
      type: "action",
      action: "remove",
      ids: [id],
    }).catch(() => {});
    assert.ok(!calls.some((c) => c.args[0] === "rm"));
  }
});
test("exec keeps user input in one argument to a fixed container shell", async () => {
  const { api, calls } = fixture({ state: "running" });
  await queryDocker(api, "pane", {
    ...context,
    type: "exec",
    id,
    input: 'printf "%s" hello',
  });
  assert.deepEqual(calls.at(-1)?.args, [
    "exec",
    id,
    "/bin/sh",
    "-c",
    'printf "%s" hello',
  ]);
});
test("bash Exec uses an explicitly allowed executable", async () => {
  const { api, calls } = fixture({ state: "running" });
  await queryDocker(api, "pane", {
    ...context,
    type: "exec",
    id,
    input: "pwd",
    shell: "bash",
  });
  assert.deepEqual(calls.at(-1)?.args, ["exec", id, "/bin/bash", "-c", "pwd"]);
});
test("exec cancels without running the command and rejects restarting containers", async () => {
  for (const options of [
    { state: "running", accept: false },
    { state: "restarting" },
  ]) {
    const { api, calls } = fixture(options);
    await queryDocker(api, "pane", {
      ...context,
      type: "exec",
      id,
      input: "pwd",
    }).catch(() => {});
    assert.ok(!calls.some((call) => call.args[0] === "exec"));
  }
});
