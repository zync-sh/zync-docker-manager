import assert from "node:assert/strict";
import { test } from "node:test";
import type { ZyncWorkerApi } from "@zync-sh/plugin-sdk/worker";
import { queryDocker } from "../src/worker/service";
import { parseQuery } from "../src/domain/protocol";
import {
  containerTerminalLaunch,
  parseTerminalResult,
} from "../src/domain/exec";
import { createRequestApi } from "../src/worker/requestLifetime";
import { createRequestScheduler } from "../src/worker/requestScheduler";

const id = "a".repeat(64);
test("terminal offer bridge rejects malformed capabilities and handles explicit fallback", () => {
  assert.deepEqual(parseTerminalResult({ supported: false }), {
    supported: false,
  });
  for (const malformed of [
    null,
    {},
    { supported: true, offerId: [], expiresInMs: 60000 },
    { supported: true, offerId: "offer", expiresInMs: Infinity },
    { supported: true, offerId: "offer", expiresInMs: 0 },
  ])
    assert.throws(() => parseTerminalResult(malformed));
});
const request = {
  type: "terminal" as const,
  requestId: "request",
  id,
  shell: "sh" as const,
  connectionToken: "token",
  daemonId: "daemon",
};
function fixture(
  options: {
    token?: string;
    state?: string;
    daemon?: string;
    deny?: boolean;
  } = {},
) {
  const commands: string[][] = [],
    offers: unknown[] = [];
  const api = {
    sshCommand: {
      execute: async (
        _pane: string,
        command: { args: string[]; expectedConnectionToken?: string },
      ) => {
        assert.equal(command.expectedConnectionToken, "token");
        commands.push(command.args);
        const stdout =
          command.args[0] === "info"
            ? JSON.stringify({ ID: options.daemon ?? "daemon", Name: "server" })
            : JSON.stringify([
                {
                  Id: id,
                  Config: {},
                  State: { Status: options.state ?? "running" },
                },
              ]);
        return { stdout, stderr: "", exitCode: 0, connectionToken: "token" };
      },
    },
    sshTerminal: {
      context: async () => {
        if (options.deny) throw new Error("Permission denied");
        return { connectionToken: options.token ?? "token" };
      },
      prepare: async (pane: string, proposal: unknown) => {
        assert.equal(pane, "pane");
        offers.push(proposal);
        return { offerId: "public-offer", expiresInMs: 60000 };
      },
    },
  } as unknown as ZyncWorkerApi;
  return { api, commands, offers };
}

test("terminal proposals are fixed argv and reject injected fields or shells", () => {
  assert.deepEqual(containerTerminalLaunch(id, "bash", "token"), {
    program: "docker",
    args: ["exec", "-it", id, "/bin/bash"],
    expectedConnectionToken: "token",
  });
  assert.deepEqual(parseQuery(request), request);
  for (const injected of [
    { program: "sh" },
    { args: ["-c", "anything"] },
    { input: "whoami" },
    { shell: "zsh" },
    { connectionId: "other" },
    { id: "--privileged" },
  ])
    assert.throws(() => parseQuery({ ...request, ...injected }));
});
test("preparation checks daemon and running container but never executes or approves a shell", async () => {
  const { api, commands, offers } = fixture();
  assert.deepEqual(await queryDocker(api, "pane", request), {
    supported: true,
    offerId: "public-offer",
    expiresInMs: 60000,
  });
  assert.deepEqual(offers, [containerTerminalLaunch(id, "sh", "token")]);
  assert.ok(
    commands.every(
      (command) => command[0] === "info" || command[0] === "container",
    ),
  );
});
test("older hosts fall back without terminal grants or SSH operations", async () => {
  const { api, commands, offers } = fixture();
  delete api.sshTerminal;
  assert.deepEqual(await queryDocker(api, "pane", request), {
    supported: false,
  });
  assert.deepEqual(commands, []);
  assert.deepEqual(offers, []);
});
test("changed connection, daemon, stopped container and denied permission never prepare", async () => {
  for (const options of [
    { token: "new" },
    { daemon: "other" },
    { state: "exited" },
    { deny: true },
  ]) {
    const { api, offers } = fixture(options);
    await assert.rejects(queryDocker(api, "pane", request));
    assert.deepEqual(offers, []);
  }
});
test("canceling during context cannot dispatch a late terminal proposal", async () => {
  const { api, offers } = fixture();
  let settle!: (value: { connectionToken: string }) => void;
  api.sshTerminal!.context = () =>
    new Promise((resolve) => {
      settle = resolve;
    });
  const controller = new AbortController();
  const scoped = createRequestApi(
    api,
    createRequestScheduler(),
    Date.now() + 10000,
    controller.signal,
  );
  const context = scoped.sshTerminal!.context("pane");
  controller.abort();
  settle({ connectionToken: "token" });
  await assert.rejects(context, /expired|canceled/);
  await assert.rejects(
    scoped.sshTerminal!.prepare(
      "pane",
      containerTerminalLaunch(id, "sh", "token"),
    ),
    /expired|canceled/,
  );
  assert.deepEqual(offers, []);
});
