import { createRoot } from "react-dom/client";
import { installThemeBridge, installTooltips } from "@zync-sh/plugin-ui";
import type { ZyncPaneApi } from "@zync-sh/plugin-sdk/pane";
import { createHostClient } from "./client";
import { createPreviewClient } from "../preview/client";
import { App } from "./App";
import "./styles.css";

declare const __PREVIEW__: boolean;
declare global {
  interface Window {
    zync?: ZyncPaneApi;
  }
}

const root = createRoot(document.getElementById("root")!);
if (!window.zync && !__PREVIEW__) {
  root.render(
    <p role="alert">Open Docker Manager inside Zync to connect to a server.</p>,
  );
} else {
  const client =
    __PREVIEW__ && !window.zync
      ? createPreviewClient()
      : createHostClient(window.zync!);
  const removeThemeBridge = installThemeBridge();
  const removeTooltips = installTooltips();
  root.render(<App client={client} preview={!window.zync} />);
  window.addEventListener(
    "pagehide",
    () => {
      client.dispose();
      removeThemeBridge();
      removeTooltips();
    },
    { once: true },
  );
}
