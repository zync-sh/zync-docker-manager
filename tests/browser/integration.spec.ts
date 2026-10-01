import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("narrow embedded pane uses its own width rather than the browser viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.src = "/";
    frame.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-modals",
    );
    frame.style.cssText =
      "position:fixed;inset:0;width:380px;height:700px;border:0;z-index:100";
    frame.title = "Embedded pane";
    document.body.append(frame);
  });
  const pane = page.frameLocator("iframe");
  await pane
    .getByRole("button", { name: "zync-api", exact: false })
    .first()
    .click();
  await expect(
    pane.getByRole("button", { name: "Back", exact: true }),
  ).toBeVisible();
  await expect(pane.locator(".container-list")).toBeHidden();
  await pane.getByRole("button", { name: "Exec / Shell", exact: true }).click();
  await expect(pane.locator(".exec form")).toHaveCount(0);
  await expect(pane.getByLabel("Shell command")).toHaveCount(0);
  await expect(pane.getByRole("status")).toContainText("updated Zync host");
  expect(
    await pane
      .locator(".workspace")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await pane.getByRole("button", { name: "Back", exact: true }).click();
  await expect(pane.getByLabel("Search containers")).toBeVisible();
});
test("batch selection, logs, and shell fallback work in preview", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("Select zync-api", { exact: true }).check();
  await page.getByLabel("Select postgres-main", { exact: true }).check();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "stop selected containers" }).click();
  await expect(page.locator(".notice")).toContainText("2 container");
  await page
    .getByRole("button", { name: "zync-api", exact: false })
    .first()
    .click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Logs", exact: true }).click();
  await expect(page.locator(".log-lines")).toContainText("INFO");
  await page.getByRole("button", { name: "Log level" }).click();
  await page.getByRole("option", { name: "Errors", exact: true }).click();
  await expect(page.locator(".log-lines")).not.toContainText("INFO");
  await page.getByRole("button", { name: "Exec / Shell", exact: true }).click();
  await expect(page.locator(".exec form")).toHaveCount(0);
  await expect(page.getByLabel("Shell command")).toHaveCount(0);
  await page.getByLabel("Use a separate terminal", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copy shell command", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".interactive-shell code")).toContainText(
    "docker exec -it",
  );
  expect(errors).toEqual([]);
});
test("production HTML loads through the chunked pane client without preview data", async ({
  page,
}) => {
  const html = await readFile("dist/ui/index.html", "utf8");
  expect(html).not.toContain("preview-only-value");
  await page.route("**/packaged", (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await page.addInitScript(() => {
    let listener: (message: unknown) => void = () => {};
    (window as unknown as { zync: unknown }).zync = {
      pane: {
        onMessage(fn: typeof listener) {
          listener = fn;
          return () => {};
        },
        postMessage(message: { type: string; requestId: string }) {
          const value =
            message.type === "snapshot"
              ? {
                  connectionToken: "test",
                  daemonId: "test",
                  containers: [],
                  host: {
                    name: "Real bridge test",
                    version: "27",
                    os: "Linux",
                    cpus: 1,
                    memory: 1024,
                  },
                  updatedAt: Date.now(),
                }
              : [];
          queueMicrotask(() => {
            listener({
              requestId: message.requestId,
              chunk: JSON.stringify(value),
            });
            listener({ requestId: message.requestId, done: true });
          });
        },
      },
    };
  });
  await page.goto("/packaged");
  await expect(page.getByText("Real bridge test")).toBeVisible();
  await expect(page.getByLabel("Preview state")).toHaveCount(0);
  await expect(page.getByText("No containers found")).toBeVisible();
});
