import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("hidden panes stop polling and resume without restarting fresh snapshots", async ({
  page,
}) => {
  const html = await readFile("dist/ui/index.html", "utf8");
  await page.route("**/visibility-package", (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await page.addInitScript(() => {
    let listener: (value: unknown) => void = () => {};
    const counts: Record<string, number> = {};
    const snapshot = {
      connectionToken: "token",
      daemonId: "daemon",
      containers: [],
      host: { name: "Host", version: "27", os: "Linux", cpus: 1, memory: 1024 },
      updatedAt: 1,
    };
    Object.assign(window, {
      requestCounts: counts,
      zync: {
        pane: {
          onMessage(callback: typeof listener) {
            listener = callback;
            return () => {};
          },
          postMessage(message: { type: string; requestId: string }) {
            counts[message.type] = (counts[message.type] ?? 0) + 1;
            queueMicrotask(() => {
              listener({
                requestId: message.requestId,
                chunk: JSON.stringify(
                  message.type === "snapshot" ? snapshot : [],
                ),
              });
              listener({ requestId: message.requestId, done: true });
            });
          },
        },
      },
    });
  });
  await page.clock.install();
  await page.goto("/visibility-package");
  const counts = () =>
    page.evaluate(
      () =>
        (window as unknown as { requestCounts: Record<string, number> })
          .requestCounts,
    );
  await expect
    .poll(async () => (await counts()).metrics ?? 0)
    .toBeGreaterThan(0);
  const signal = (visible: boolean) =>
    page.evaluate((value) => {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: window.parent,
          data: { type: "zync:pane:visibility", visible: value },
        }),
      );
    }, visible);
  await signal(false);
  await page.clock.runFor(50);
  const before = await counts();
  await page.clock.runFor(10000);
  expect(await counts()).toEqual(before);
  await signal(true);
  await expect
    .poll(async () => (await counts()).metrics ?? 0)
    .toBeGreaterThan(before.metrics);
  expect((await counts()).snapshot).toBe(1);
  await signal(false);
  await page.clock.runFor(31000);
  await signal(true);
  await expect.poll(async () => (await counts()).snapshot).toBe(2);
});
