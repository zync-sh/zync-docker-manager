import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("whole groups can be stopped and removed with per-batch confirmations", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Select zync-stack", { exact: true }).check();
  await expect(page.locator(".batch")).toContainText("7 selected");
  let confirmations = 0;
  page.on("dialog", async (dialog) => {
    confirmations++;
    await dialog.accept();
  });
  await page.getByRole("button", { name: "stop selected containers" }).click();
  await expect(page.locator(".notice")).toContainText("6 container(s)");
  expect(confirmations).toBe(2);
  const remove = page.getByRole("button", {
    name: "Remove selected stopped containers",
  });
  await expect(remove).toBeEnabled();
  await remove.hover();
  await expect(page.getByRole("tooltip")).toContainText("volumes are kept");
  await remove.click();
  await expect(page.locator(".notice")).toContainText("7 container(s)");
  await expect(
    page.getByLabel("Select zync-stack", { exact: true }),
  ).toHaveCount(0);
  expect(confirmations).toBe(4);
});

test("canceling a later batch preserves the untouched remainder", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Select zync-stack", { exact: true }).check();
  let confirmations = 0;
  page.on("dialog", async (dialog) => {
    confirmations++;
    if (confirmations === 1) await dialog.accept();
    else await dialog.dismiss();
  });
  await page.getByRole("button", { name: "stop selected containers" }).click();
  await expect(page.locator(".notice")).toContainText(
    "Action canceled. 5 container(s) completed",
  );
  expect(confirmations).toBe(2);
});
test("network groups share selection and flat view has no group headers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 480, height: 700 });
  await page.goto("/");
  await page.getByRole("button", { name: "Group containers by" }).click();
  await page.getByRole("option", { name: "Network", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "zync-api", exact: false }),
  ).toHaveCount(2);
  await page.getByLabel("Select zync-api", { exact: true }).first().check();
  await expect(
    page.getByLabel("Select zync-api", { exact: true }).nth(1),
  ).toBeChecked();
  await expect(page.locator(".batch")).toContainText("1 selected");
  await page.getByRole("button", { name: "Group containers by" }).click();
  await page.getByRole("option", { name: "None", exact: true }).click();
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
  await expect(page.locator(".loading-symbol img")).toBeVisible();
  await expect(page.getByText("No containers found")).toHaveCount(0);
  await expect(page.getByText("No containers found")).toBeVisible();
  await page
    .getByRole("button", { name: "Refresh Docker", exact: true })
    .click();
  await expect(page.locator(".refresh-progress")).toBeVisible();
  await expect(page.getByText("No containers found")).toBeVisible();
});
