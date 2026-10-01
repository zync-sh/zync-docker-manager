import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const hostGeometry = fileURLToPath(
  new URL(
    "../../../zync/src/features/plugins/terminal/surfaceOcclusion.ts",
    import.meta.url,
  ),
);

/** Cross-frame paint and hit testing using the local host candidate's real geometry. */
for (const popupY of [110, 160]) {
  test(`popup at ${popupY} passes through host surface without changing its bounds`, async ({
    page,
  }) => {
    test.skip(
      !existsSync(hostGeometry),
      "Host geometry integration requires a sibling Zync checkout.",
    );
    const compiled = await build({
      entryPoints: [hostGeometry],
      bundle: true,
      write: false,
      format: "iife",
      globalName: "geometry",
    });
    await page.setContent(`<style>body{margin:0}iframe{position:absolute;border:0;width:600px;height:500px}#terminal{position:absolute;left:10px;top:100px;width:500px;height:300px;background:black;color:white}</style>
    <iframe title="plugin"></iframe><div id="terminal">Trusted terminal header</div>`);
    await page.addScriptTag({ content: compiled.outputFiles[0].text });
    await page.locator("iframe").evaluate((frame: HTMLIFrameElement, y) => {
      frame.srcdoc = `<style>body{margin:0}button{position:absolute;left:300px;top:${y}px;width:180px;height:60px}</style><button onclick="this.textContent='Clicked'">Popup</button>`;
    }, popupY);
    const popup = page
      .frameLocator("iframe")
      .getByRole("button", { name: "Popup" });
    await expect(popup).toBeVisible();
    const bounds = await page.locator("#terminal").boundingBox();
    await page.evaluate((y) => {
      const api = (
        window as unknown as {
          geometry: {
            terminalOcclusion: (
              clip: unknown,
              overlays: unknown[],
            ) => { clipPath?: string; hidden: boolean };
          };
        }
      ).geometry;
      const slot = { x: 10, y: 100, width: 500, height: 300 };
      const clip = api.terminalOcclusion(slot, [
        { x: 300, y, width: 180, height: 60 },
        { x: 310, y: y + 10, width: 120, height: 40 },
      ]);
      document.getElementById("terminal")!.style.clipPath = clip.clipPath!;
    }, popupY);
    await popup.click();
    await expect(
      page.frameLocator("iframe").getByRole("button", { name: "Clicked" }),
    ).toBeVisible();
    expect(await page.locator("#terminal").boundingBox()).toEqual(bounds);
    expect(
      await page.evaluate(() => document.elementFromPoint(20, 110)?.id),
    ).toBe("terminal");
    expect(
      await page.evaluate(() => document.elementFromPoint(20, 250)?.id),
    ).toBe("terminal");
    await page.locator("#terminal").evaluate((element) => {
      element.style.clipPath = "";
    });
    expect(
      await page.evaluate(() => document.elementFromPoint(350, 180)?.id),
    ).toBe("terminal");
  });
}
