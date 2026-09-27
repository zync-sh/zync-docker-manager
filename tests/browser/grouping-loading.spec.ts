import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("network groups share selection and flat view has no group headers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 480, height: 700 });
  await page.goto("/");
  await page.getByLabel("Group containers by").selectOption("network");
  await expect(
    page.getByRole("button", { name: "zync-api", exact: false }),
  ).toHaveCount(2);
  await page.getByLabel("Select zync-api", { exact: true }).first().check();
  await expect(
    page.getByLabel("Select zync-api", { exact: true }).nth(1),
  ).toBeChecked();
  await expect(page.locator(".batch")).toContainText("1 selected");
  await page.getByLabel("Group containers by").selectOption("none");
  await expect(page.locator(".group-heading")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "zync-api", exact: false }),
  ).toHaveCount(1);
  expect(
    await page
      .locator(".workspace")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
});
test("production loading shows skeleton first and preserves workspace during refresh", async ({
  page,
}) => {
  const html = await readFile("dist/ui/index.html", "utf8");
  await page.route("**/loading-package", (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await page.addInitScript(() => {
    let listener: (value: unknown) => void = () => {};
    const snapshot = {
      connectionToken: "token",
      daemonId: "daemon",
      containers: [],
      host: {
        name: "Slow host",
        version: "27",
        os: "Linux",
        cpus: 1,
        memory: 1024,
      },
      updatedAt: 1,
    };
    (window as unknown as { zync: unknown }).zync = {
      pane: {
        onMessage(fn: typeof listener) {
          listener = fn;
          return () => {};
        },
        postMessage(message: { type: string; requestId: string }) {
          setTimeout(
            () => {
              listener({
                requestId: message.requestId,
                chunk: JSON.stringify(
                  message.type === "snapshot" ? snapshot : [],
                ),
              });
              listener({ requestId: message.requestId, done: true });
            },
            message.type === "snapshot" ? 1300 : 0,
          );
        },
      },
    };
  });
  await page.goto("/loading-package");
  await expect(page.locator(".loading-skeleton")).toBeVisible();
  await expect(page.getByText("No containers found")).toHaveCount(0);
  await expect(page.getByText("No containers found")).toBeVisible();
  await page
    .getByRole("button", { name: "Refresh Docker", exact: true })
    .click();
  await expect(page.locator(".refresh-progress")).toBeVisible();
  await expect(page.getByText("No containers found")).toBeVisible();
});
