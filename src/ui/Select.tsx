import { useLayoutEffect, useRef, type SelectHTMLAttributes } from "react";
import { enhanceSelects } from "@zync-sh/plugin-ui";

/** Own the enhanced control's DOM so React and the shared UI toolkit stay isolated. */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const root = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (root.current) return enhanceSelects(root.current);
  }, [props.value, props.disabled]);

  return (
    <span ref={root} className="select-field">
      <select {...props} />
    </span>
  );
}
