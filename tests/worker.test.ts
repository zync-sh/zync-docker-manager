import { build } from "esbuild";
import vm from "node:vm";
import assert from "node:assert/strict";
import { test } from "node:test";

test("bundled worker proposes fixed terminals and rejects the removed command runner", async () => {
  const bundled = await build({
    entryPoints: ["src/worker/index.ts"],
    bundle: true,
    format: "iife",
    write: false,
  });
  const id = "a".repeat(64);
  let listener: (event: unknown) => void = () => {};
  const commands: string[][] = [],
    offers: unknown[] = [];
  let content = "",
    deny = false;
  let complete: (value: Record<string, unknown>) => void = () => {};
  const api = {
    on() {},
    panel: {
      onMessage(callback: typeof listener) {
        listener = callback;
      },
      postMessage(
        _pane: string,
        message: { chunk?: string; done?: boolean; error?: string },
      ) {
        if (message.chunk) content += message.chunk;
        if (message.done) complete(JSON.parse(content));
        if (message.error) complete({ error: message.error });
        return Promise.resolve(true);
      },
    },
    sshCommand: {
      execute: async (_pane: string, request: { args: string[] }) => {
        commands.push(request.args);
        return {
          stdout:
            request.args[0] === "info"
              ? JSON.stringify({ ID: "daemon", Name: "host" })
              : JSON.stringify([
                  { Id: id, Config: {}, State: { Status: "running" } },
                ]),
          stderr: "",
          exitCode: 0,
          connectionToken: "token",
        };
      },
    },
    sshTerminal: {
      context: async () => {
        if (deny) throw new Error("Permission denied");
        return { connectionToken: "token" };
      },
      prepare: async (_pane: string, proposal: unknown) => {
        offers.push(proposal);
        return { offerId: "public-offer", expiresInMs: 60000 };
      },
    },
  };
  vm.runInNewContext(bundled.outputFiles[0].text, {
    zync: api,
    setTimeout,
    clearTimeout,
    AbortController,
  });
  listener({
    paneInstanceId: "pane",
    message: {
      type: "exec",
      requestId: "old",
      id,
      input: "whoami",
      connectionToken: "token",
      daemonId: "daemon",
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(commands.length, 0);
  const run = () =>
    new Promise<Record<string, unknown>>((resolve) => {
      content = "";
      complete = resolve;
      listener({
        paneInstanceId: "pane",
        message: {
          type: "terminal",
          requestId: "request",
          id,
          shell: "sh",
          connectionToken: "token",
          daemonId: "daemon",
        },
      });
    });
  assert.equal((await run()).offerId, "public-offer");
  assert.equal(
    JSON.stringify(offers[0]),
    JSON.stringify({
      program: "docker",
      args: ["exec", "-it", id, "/bin/sh"],
      expectedConnectionToken: "token",
    }),
  );
  assert.ok(commands.every((args) => args[0] !== "exec"));
  await new Promise((resolve) => setImmediate(resolve));
  deny = true;
  assert.match(String((await run()).error), /Permission denied/);
  assert.equal(offers.length, 1);
});
