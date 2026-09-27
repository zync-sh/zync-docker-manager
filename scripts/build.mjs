import { build } from "esbuild";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { validatePackageDirectory } from "@zync-sh/plugin-sdk/validate";

await mkdir("dist/ui", { recursive: true });
await build({
  entryPoints: ["src/worker/index.ts"],
  bundle: true,
  format: "iife",
  target: "es2022",
  minify: true,
  outfile: "dist/worker.js",
});
const ui = await build({
  entryPoints: ["src/ui/main.tsx"],
  bundle: true,
  format: "iife",
  target: "es2022",
  minify: true,
  define: { __PREVIEW__: "false", "process.env.NODE_ENV": '"production"' },
  write: false,
  metafile: true,
  loader: { ".svg": "dataurl" },
  outfile: "pane.js",
});
const script = ui.outputFiles
  .find((file) => file.path.endsWith(".js"))
  .text.replaceAll("</script", "<\\/script");
const css = ui.outputFiles.find((file) => file.path.endsWith(".css")).text;
await writeFile(
  "dist/ui/index.html",
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Docker Manager</title><style>${css}</style></head><body><div id="root"></div><script>${script}</script></body></html>`,
);
await copyFile("manifest.json", "dist/manifest.json");
await copyFile("LICENSE", "dist/LICENSE");
await mkdir("dist/icons", { recursive: true });
await copyFile("src/icons/docker-manager.svg", "dist/icons/docker-manager.svg");
const validation = validatePackageDirectory("dist", {
  pluginApiVersion: "2.1.0",
});
if (!validation.valid) throw new Error(JSON.stringify(validation.issues));
const html = await readFile("dist/ui/index.html", "utf8");
// Match the native pane-registration limit, not the larger registry/SSH limits.
const paneBytes = Buffer.byteLength(html, "utf8");
if (paneBytes > 512 * 1024)
  throw new Error(
    `Pane HTML is ${paneBytes} bytes; Zync allows at most 524288 bytes.`,
  );
if (
  Object.values(ui.metafile.outputs).some((output) =>
    Object.entries(output.inputs).some(
      ([path, input]) =>
        path.includes("src/preview/") && input.bytesInOutput > 0,
    ),
  )
)
  throw new Error("Preview fixtures leaked into the release bundle.");
console.log(
  `Built and validated Docker plugin: pane HTML ${paneBytes} / 524288 bytes.`,
);
