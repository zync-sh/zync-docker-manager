import { build } from "esbuild";
import vm from "node:vm";
import assert from "node:assert/strict";
import { test } from "node:test";
const id = "a".repeat(64);
test("bundled Worker validates, confirms and returns real Exec output over chunks", async () => {
  const bundled = await build({
    entryPoints: ["src/worker/index.ts"],
    bundle: true,
    format: "iife",
    write: false,
  });
  let listener: (event: unknown) => void = () => {};
  const calls: string[][] = [];
  let confirmed = false;
  let deny = false;
  let complete: (value: Record<string, unknown>) => void = () => {};
  let content = "";
  const api = {
    on() {},
    panel: {
      onMessage(fn: typeof listener) {
        listener = fn;
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
    ui: {
      confirm: async () => {
        if (deny) throw "Permission ui.dialog.confirm denied";
        confirmed = true;
        return true;
      },
    },
    sshCommand: {
      execute: async (_pane: string, request: { args: string[] }) => {
        calls.push([...request.args]);
        const stdout =
          request.args[0] === "info"
            ? JSON.stringify({ ID: "daemon", Name: "host" })
            : request.args[0] === "container"
              ? JSON.stringify([
                  { Id: id, Config: {}, State: { Status: "running" } },
                ])
              : "app\n";
        return { stdout, stderr: "", exitCode: 0, connectionToken: "token" };
      },
    },
  };
  vm.runInNewContext(bundled.outputFiles[0].text, { zync: api });
  const run = () =>
    new Promise<Record<string, unknown>>((resolve) => {
      content = "";
      complete = resolve;
      listener({
        paneInstanceId: "pane",
        message: {
          requestId: "request",
          type: "exec",
          id,
          input: "whoami",
          connectionToken: "token",
          daemonId: "daemon",
        },
      });
    });
  assert.equal((await run()).text, "app\n");
  assert.equal(confirmed, true);
  assert.deepEqual(calls.at(-1), ["exec", id, "/bin/sh", "-c", "whoami"]);
  await new Promise((resolve) => setImmediate(resolve));
  deny = true;
  const before = calls.filter((args) => args[0] === "exec").length;
  assert.match(String((await run()).error), /permission.*confirm.*denied/i);
  assert.equal(calls.filter((args) => args[0] === "exec").length, before);
});
