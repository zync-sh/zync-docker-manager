import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

for (const supported of [true, false]) {
  test(`packaged terminal slot ${supported ? "mounts and disposes" : "provides copy-only fallback"}`, async ({
    page,
  }) => {
    const html = await readFile("dist/ui/index.html", "utf8");
    await page.route("**/terminal-package", (route) =>
      route.fulfill({ contentType: "text/html", body: html }),
    );
    await page.addInitScript(
      ({ supported }) => {
        const messages: Array<Record<string, unknown>> = [];
        (window as unknown as { terminalMessages: unknown }).terminalMessages =
          messages;
        window.addEventListener("message", (event) => {
          if (event.data?.type === "zync:terminal:hello")
            window.postMessage(
              {
                type: "zync:terminal:host",
                version: 1,
                nonce: "host-document",
                overlays: true,
              },
              "*",
            );
          if (event.data?.type === "zync:terminal:surface")
            messages.push(event.data);
        });
        const id = "a".repeat(64);
        let reply: (message: unknown) => void = () => {};
        (window as unknown as { zync: unknown }).zync = {
          pane: {
            onMessage(callback: typeof reply) {
              reply = callback;
              return () => {};
            },
            postMessage(request: { type: string; requestId: string }) {
              if (request.type === "cancel") return;
              if (request.type === "terminal")
                messages.push({ type: "terminal-request" });
              const container = {
                id,
                name: "terminal-test",
                state: "running",
                image: "test",
                status: "Up",
                ports: "",
                project: "",
                networks: [],
                health: "",
              };
              const result =
                request.type === "snapshot"
                  ? {
                      connectionToken: "token",
                      daemonId: "daemon",
                      containers: [container],
                      host: {
                        name: "test",
                        version: "27",
                        os: "Linux",
                        cpus: 1,
                        memory: 1024,
                      },
                      updatedAt: Date.now(),
                    }
                  : request.type === "inspect"
                    ? {
                        ...container,
                        restartCount: 0,
                        environment: [],
                        ports: [],
                        mounts: [],
                      }
                    : request.type === "terminal"
                      ? supported
                        ? {
                            supported: true,
                            offerId: "public-offer",
                            expiresInMs: 60000,
                          }
                        : { supported: false }
                      : [];
              queueMicrotask(() => {
                reply({
                  requestId: request.requestId,
                  chunk: JSON.stringify(result),
                });
                reply({ requestId: request.requestId, done: true });
              });
            },
          },
        };
      },
      { supported },
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/terminal-package");
    await page
      .getByRole("button", { name: "terminal-test", exact: false })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Exec / Shell", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Prepare interactive shell",
        exact: true,
      }),
    ).toHaveCount(0);
    if (supported) {
      await expect(page.getByLabel("Zync terminal slot")).toBeVisible();
      const slot = await page.getByLabel("Zync terminal slot").elementHandle();
      const space = await page
        .locator(".container-terminal")
        .evaluate((element) => ({
          total: element.getBoundingClientRect().height,
          terminal: element
            .querySelector(".container-terminal-slot")!
            .getBoundingClientRect().height,
        }));
      expect(space.terminal).toBeGreaterThan(space.total - 85);
      const shellPicker = page.getByRole("button", {
        name: "Container shell",
        exact: true,
      });
      const originalBounds = await page
        .getByLabel("Zync terminal slot")
        .boundingBox();
      await shellPicker.click();
      const menu = page.getByRole("listbox", { name: "Container shell" });
      await expect(menu).toBeVisible();
      await expect
        .poll(async () => {
          return page.evaluate(
            () =>
              (
                window as unknown as {
                  terminalMessages: Array<{ overlays?: unknown[] }>;
                }
              ).terminalMessages.at(-1)?.overlays?.length === 1,
          );
        })
        .toBe(true);
      const alignment = await page
        .locator(".container-terminal")
        .evaluate((element) => {
          const panel = element.getBoundingClientRect();
          const terminal = element
            .querySelector(".container-terminal-slot")!
            .getBoundingClientRect();
          return {
            left: terminal.left - panel.left,
            right: panel.right - terminal.right,
          };
        });
      expect(alignment.left).toBeCloseTo(8, 0);
      expect(await page.getByLabel("Zync terminal slot").boundingBox()).toEqual(
        originalBounds,
      );
      expect(alignment.right).toBeCloseTo(8, 0);
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(page.getByLabel("Zync terminal slot")).toHaveCSS(
        "margin-top",
        "0px",
      );
      expect(await slot!.evaluate((node) => node.isConnected)).toBe(true);
      // Ordinary snapshot refresh must not replace a slot or require a new offer.
      await page
        .getByRole("button", { name: "Refresh Docker", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Refresh Docker", exact: true }),
      ).toBeEnabled();
      expect(await slot!.evaluate((node) => node.isConnected)).toBe(true);
      expect(
        await page.evaluate(
          () =>
            (
              window as unknown as { terminalMessages: Array<{ type: string }> }
            ).terminalMessages.filter(
              (message) => message.type === "terminal-request",
            ).length,
        ),
      ).toBe(1);
      await expect
        .poll(() =>
          page.evaluate(() =>
            (
              window as unknown as {
                terminalMessages: Array<{ rect?: { width: number } }>;
              }
            ).terminalMessages.some(
              (message) => (message.rect?.width ?? 0) >= 240,
            ),
          ),
        )
        .toBe(true);
      await page.getByRole("button", { name: "Overview", exact: true }).click();
      await expect(page.getByLabel("Zync terminal slot")).toBeHidden();
      expect(await slot!.evaluate((node) => node.isConnected)).toBe(true);
      await page
        .getByRole("button", { name: "Exec / Shell", exact: true })
        .click();
      await expect(page.getByLabel("Zync terminal slot")).toBeVisible();
      for (const name of ["Images", "Volumes", "Networks"]) {
        await page.getByRole("button", { name, exact: true }).click();
        await expect(page.getByLabel("Zync terminal slot")).toBeHidden();
        expect(await slot!.evaluate((node) => node.isConnected)).toBe(true);
      }
      await page.getByRole("button", { name: /^Containers/ }).click();
      await expect(page.getByLabel("Zync terminal slot")).toBeVisible();
      const lifecycle = await page.evaluate(
        () =>
          (
            window as unknown as {
              terminalMessages: Array<{ type: string; dispose?: boolean }>;
            }
          ).terminalMessages,
      );
      expect(
        lifecycle.filter((message) => message.type === "terminal-request"),
      ).toHaveLength(1);
      expect(lifecycle.some((message) => message.dispose)).toBe(false);
      await page
        .getByRole("button", { name: "Close inspector", exact: true })
        .click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            (
              window as unknown as {
                terminalMessages: Array<{ dispose?: boolean }>;
              }
            ).terminalMessages.some((message) => message.dispose),
          ),
        )
        .toBe(true);
    } else {
      await expect(page.getByRole("status")).toContainText(
        "does not support embedded terminals",
      );
      await expect(page.getByLabel("Shell command")).toHaveCount(0);
      await page.getByLabel("Use a separate terminal", { exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Copy shell command", exact: true }),
      ).toBeEnabled();
    }
    expect(errors).toEqual([]);
  });
}
