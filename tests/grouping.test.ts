import assert from "node:assert/strict";
import { test } from "node:test";
import { parseContainers } from "../src/domain/docker";
import { groupContainers } from "../src/domain/grouping";
const rows = parseContainers(
  [
    JSON.stringify({
      ID: "a".repeat(64),
      Names: "api",
      Networks: "front,back,front",
      Labels: "com.docker.compose.project=app",
    }),
    JSON.stringify({ ID: "b".repeat(64), Names: "job", Networks: "" }),
  ].join("\n"),
);
test("network membership is deduplicated and missing networks are separate", () => {
  assert.deepEqual(rows[0].networks, ["front", "back"]);
  const groups = groupContainers(rows, "network");
  assert.deepEqual([...groups.keys()], ["front", "back", "No network"]);
  assert.equal(groups.get("front")![0].id, groups.get("back")![0].id);
  assert.equal(groups.get("No network")![0].name, "job");
});
test("Compose and flat groups contain each container once", () => {
  assert.deepEqual(
    [...groupContainers(rows, "compose").keys()],
    ["app", "standalone"],
  );
  assert.deepEqual([...groupContainers(rows, "none").values()], [rows]);
});
