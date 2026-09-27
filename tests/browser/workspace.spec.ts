import { test, expect } from "@playwright/test";
for (const width of [320, 480, 900, 1600])
  test(`workspace fits ${width}px and opens every inspector tab`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "zync-api", exact: false }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "zync-api", exact: false })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "zync-api" })).toBeVisible();
    for (const name of [
      "Environment",
      "Ports",
      "Mounts",
      "Logs",
      "Exec / Shell",
      "Overview",
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(page.locator(".inspector-content")).toBeVisible();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator(".workspace")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/workspace-${width}.png` });
  });
test("search, resources, protected actions and masked environment", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Search containers" })
    .fill("postgres");
  await expect(
    page.getByRole("button", { name: "zync-api", exact: false }),
  ).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search containers" }).fill("");
  await page
    .getByRole("button", { name: "zync-api", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Environment", exact: true }).click();
  await expect(
    page.getByText("preview-only-value", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reveal API_TOKEN" }).click();
  await expect(
    page.getByText("preview-only-value", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeEnabled();
  for (const name of ["Images", "Volumes", "Networks"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".resource-row").first()).toBeVisible();
  }
});
test("preview failure states and light theme remain usable", async ({
  page,
}) => {
  await page.goto("/");
  for (const state of ["permission", "unavailable", "disconnected", "failed"]) {
    await page.getByLabel("Preview state").selectOption(state);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  }
  await page.getByLabel("Preview state").selectOption("empty");
  await expect(page.getByText("No containers found")).toBeVisible();
  await page.getByRole("button", { name: "Toggle preview theme" }).click();
  await expect(page.locator(".docker-host")).toHaveAttribute(
    "data-theme",
    "light",
  );
});
