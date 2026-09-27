import assert from "node:assert/strict";
import { test } from "node:test";
import {
  containerId,
  parseContainers,
  parseInfo,
  parseInspection,
  parseMetrics,
  parseResources,
} from "../src/domain/docker";
import { parseQuery } from "../src/domain/protocol";
const id = "a".repeat(64),
  context = {
    connectionToken: "token",
    daemonId: "daemon",
    requestId: "request-1",
  };
test("only full IDs and bounded typed operations are accepted", () => {
  assert.equal(containerId(id), id);
  for (const value of ["--help", "abc; rm -rf /", "abc", null])
    assert.throws(() => containerId(value));
  assert.deepEqual(parseQuery({ type: "snapshot", requestId: "request-1" }), {
    type: "snapshot",
    requestId: "request-1",
  });
  for (const value of [
    { type: "delete" },
    { type: "action", action: "remove", ids: [] },
    { type: "action", action: "start", ids: [id, id] },
    { type: "action", action: "prune", ids: [id] },
    { type: "exec", id, input: "x".repeat(1001) },
    { type: "exec", id, input: "echo one\necho two" },
    { type: "exec", id, input: "pwd", shell: "arbitrary-shell" },
    { type: "logs", id: "--help" },
  ])
    assert.throws(() => parseQuery({ ...context, ...value }));
  assert.throws(() => parseQuery({ type: "logs", id, requestId: "request-1" }));
  assert.equal(
    parseQuery({ ...context, type: "exec", id, input: "echo hello" }).type,
    "exec",
  );
});
test("Docker JSON lines are bounded and Compose labels are parsed", () => {
  const row = JSON.stringify({
    ID: id,
    Names: "api",
    Image: "api:latest",
    State: "running",
    Status: "Up 1 hour (healthy)",
    Labels: "com.docker.compose.project=stack,other=value",
  });
  assert.equal(parseContainers(row)[0].project, "stack");
  assert.equal(parseContainers(row)[0].health, "healthy");
  assert.deepEqual(parseContainers(""), []);
  assert.throws(() => parseContainers("not json"));
  assert.throws(() => parseContainers(Array(501).fill(row).join("\n")));
});
test("inspect returns only allowlisted fields and verifies identity", () => {
  const data = JSON.stringify([
    {
      Id: id,
      Name: "/api",
      Config: { Image: "api:v1", Env: ["SECRET=one"] },
      State: { Status: "running" },
      NetworkSettings: {
        Ports: { "80/tcp": [{ HostIp: "127.0.0.1", HostPort: "8080" }] },
      },
      Mounts: [
        { Source: "/data", Destination: "/app", Type: "bind", RW: false },
      ],
      SecretInternal: "not forwarded",
    },
  ]);
  const result = parseInspection(data, id);
  assert.equal(result.name, "api");
  assert.equal(result.ports[0], "127.0.0.1:8080 → 80/tcp");
  assert.equal(result.mounts[0], "/data → /app (bind, read-only)");
  assert.equal("SecretInternal" in result, false);
  assert.throws(() => parseInspection(data, "b".repeat(64)));
});
test("metrics and resource lists preserve real values", () => {
  assert.equal(
    parseMetrics(
      JSON.stringify({ ID: id, CPUPerc: "140.2%", MemPerc: "2.1%" }),
    )[0].cpu,
    140.2,
  );
  assert.equal(
    parseResources(
      JSON.stringify({ Name: "data", Driver: "local" }),
      "volumes",
    )[0].name,
    "data",
  );
  assert.equal(
    parseInfo(JSON.stringify({ ID: "daemon", Name: "host" })).host.name,
    "host",
  );
  assert.throws(() => parseInfo("{}"));
});
