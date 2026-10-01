import { test, expect } from "@playwright/test";

test("Escape clears a non-empty container search before bubbling", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    document.body.dataset.escapeCount = "0";
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        document.body.dataset.escapeCount = String(
          Number(document.body.dataset.escapeCount) + 1,
        );
      }
    });
  });
  const search = page.getByLabel("Search containers");
  await search.fill("no-such-container");
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(page.locator("body")).toHaveAttribute("data-escape-count", "0");
  await search.press("Escape");
  await expect(page.locator("body")).toHaveAttribute("data-escape-count", "1");
});

test("quick start is dismissible and can be reopened", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: "test-results/docker-welcome.png" });
  await expect(
    page.getByRole("region", { name: "Docker quick start" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss quick start" }).click();
  await expect(
    page.getByRole("region", { name: "Docker quick start" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Docker quick start", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Docker quick start" }),
  ).toBeVisible();
});

test("inspector resizes by keyboard and expands without losing its selected tab", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "zync-api", exact: false })
    .first()
    .click();
  const divider = page.getByRole("separator", { name: "Resize details panel" });
  await divider.focus();
  await page.keyboard.press("End");
  await expect(divider).toHaveAttribute("aria-valuenow", "65");
  expect(
    await page
      .locator(".container-workspace")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "Logs", exact: true }).click();
  await page.getByRole("button", { name: "Expand details panel" }).click();
  await expect(page.locator(".container-list")).toBeHidden();
  await expect(page.locator(".log-lines")).toBeVisible();
  await page.screenshot({ path: "test-results/docker-logs-expanded.png" });
  await page.getByRole("button", { name: "Restore details panel" }).click();
  await expect(page.locator(".container-list")).toBeVisible();
  await expect(page.locator(".log-lines")).toBeVisible();
});

test("secondary actions and row keyboard navigation remain accessible", async ({
  page,
}) => {
  await page.goto("/");
  const first = page.locator(".container-name").first();
  await first.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".container-name").nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByLabel("More container actions").click();
  await expect(
    page.getByRole("button", { name: "Remove container", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.locator(".more-actions")).not.toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(
    await page
      .locator(".container-list")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: "test-results/docker-list-narrow.png" });
});

test("log controls and resource empty search states work", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "zync-api", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "Logs", exact: true }).click();
  await expect(page.locator(".log-lines")).toContainText("INFO");
  await page.getByRole("button", { name: "Wrap", exact: true }).click();
  await expect(page.locator(".log-lines")).toHaveClass(/no-wrap/);
  await page.getByLabel("Search logs").fill("no-such-message");
  await expect(page.locator(".log-lines")).toContainText(
    "No logs match your filters.",
  );
  await expect(
    page.getByRole("button", { name: "Copy displayed logs" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Images", exact: true }).click();
  await page.getByLabel("Search images").fill("no-such-image");
  await expect(
    page.getByRole("heading", { name: "No matching resources" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.locator(".resource-row").first()).toBeVisible();
});
