import { useLayoutEffect, useRef, type SelectHTMLAttributes } from "react";
import { enhanceSelects } from "@zync-sh/plugin-ui";
import { registerTerminalOverlay } from "@zync-sh/plugin-sdk/terminal";

/** Own the enhanced control's DOM so React and the shared UI toolkit stay isolated. */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const root = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!root.current) return;
    const dispose = enhanceSelects(root.current);
    const trigger = root.current.querySelector("[aria-controls]");
    const menuId = trigger?.getAttribute("aria-controls");
    const menu = menuId ? document.getElementById(menuId) : null;
    let overlay: ReturnType<typeof registerTerminalOverlay> | undefined;
    // Adapt every shared dropdown to the host contract, not just the shell picker.
    const sync = () => {
      if (menu && !menu.hidden) overlay ??= registerTerminalOverlay(menu);
      else {
        overlay?.dispose();
        overlay = undefined;
      }
    };
    const observer = new MutationObserver(sync);
    if (menu)
      observer.observe(menu, {
        attributes: true,
        attributeFilter: ["hidden", "style"],
      });
    sync();
    return () => {
      observer.disconnect();
      overlay?.dispose();
      dispose();
    };
  }, [props.value, props.disabled]);

  return (
    <span ref={root} className="select-field">
      <select {...props} />
    </span>
  );
}
