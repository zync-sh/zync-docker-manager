import { test, expect } from "@playwright/test";
import { build } from "esbuild";

test("sandboxed copy uses user activation and keeps feedback panel open", async ({
  page,
}) => {
  const bundle = await build({
    entryPoints: ["src/ui/copyText.ts"],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "copyApi",
  });
  await page.setContent('<iframe sandbox="allow-scripts"></iframe>');
  await page.locator("iframe").evaluate((frame: HTMLIFrameElement, script) => {
    frame.srcdoc = `<details open onfocusout="if(!this.contains(event.relatedTarget))this.open=false"><summary>Command</summary><button>Copy</button><output></output></details><script>${script}
      document.addEventListener('copy', event => { event.preventDefault(); document.body.dataset.copied = document.querySelector('textarea').value; });
      document.querySelector('button').onclick = async event => { document.querySelector('output').textContent = await copyApi.copyText('docker exec test', event.currentTarget.parentElement) ? 'Copied' : 'Blocked'; };
    </script>`;
  }, bundle.outputFiles[0].text);
  const frame = page.frameLocator("iframe");
  await frame.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(frame.locator("output")).toHaveText("Copied");
  await expect(frame.locator("body")).toHaveAttribute(
    "data-copied",
    "docker exec test",
  );
  await expect(frame.locator("details")).toHaveAttribute("open", "");
  await expect(frame.locator("textarea")).toHaveCount(0);
  await frame.locator("button").evaluate(() => {
    document.execCommand = () => false;
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
  });
  await frame.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(frame.locator("output")).toHaveText("Blocked");
});
