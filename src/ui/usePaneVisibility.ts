import { useEffect, useState } from "react";

interface PaneVisibilityApi {
  isVisible?: () => boolean;
  onVisibilityChange?: (callback: (visible: boolean) => void) => () => void;
}

function visibilityApi(): PaneVisibilityApi | undefined {
  return (window as unknown as { zync?: { pane?: PaneVisibilityApi } }).zync
    ?.pane;
}

/** Host visibility is independent of the browser window's visibility. */
export function usePaneVisibility() {
  const [paneVisible, setPaneVisible] = useState(
    () => visibilityApi()?.isVisible?.() ?? true,
  );
  const [windowVisible, setWindowVisible] = useState(!document.hidden);

  useEffect(() => {
    const unsubscribe = visibilityApi()?.onVisibilityChange?.(setPaneVisible);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const data = event.data;
      if (
        data?.type === "zync:pane:visibility" &&
        typeof data.visible === "boolean"
      ) {
        setPaneVisible(data.visible);
      }
    };
    const onVisibility = () => setWindowVisible(!document.hidden);

    window.addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe?.();
      window.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return paneVisible && windowVisible;
}
