import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRef } from "react";

/** Secondary actions remain keyboard accessible and close before confirmation. */
export function ContainerMoreActions({
  removable,
  onRemove,
}: {
  removable: boolean;
  onRemove(): void;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={disclosure}
      className="more-actions"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          event.currentTarget.open = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label="More container actions" data-tooltip="More actions">
        <MoreHorizontal size={16} />
      </summary>
      <div className="more-actions-content">
        <button
          className="danger-icon"
          disabled={!removable}
          onClick={() => {
            if (disclosure.current) disclosure.current.open = false;
            onRemove();
          }}
        >
          <Trash2 size={14} />
          Remove container
        </button>
        <small>
          {removable
            ? "Volumes are kept."
            : "Stop the container before removing it."}
        </small>
      </div>
    </details>
  );
}
