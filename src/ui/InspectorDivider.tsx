/** Pointer capture and keyboard arrows resize only this pane's inspector. */
export function InspectorDivider({
  value,
  onChange,
}: {
  value: number;
  onChange(value: number): void;
}) {
  const clamp = (next: number) => Math.max(30, Math.min(65, next));
  return (
    <div
      className="inspector-divider"
      role="separator"
      tabIndex={0}
      aria-label="Resize details panel"
      aria-orientation="vertical"
      aria-valuemin={30}
      aria-valuemax={65}
      aria-valuenow={Math.round(value)}
      onKeyDown={(event) => {
        const next =
          event.key === "ArrowLeft"
            ? value + 2
            : event.key === "ArrowRight"
              ? value - 2
              : event.key === "Home"
                ? 30
                : event.key === "End"
                  ? 65
                  : null;
        if (next !== null) {
          event.preventDefault();
          onChange(clamp(next));
        }
      }}
      onPointerDown={(event) => {
        if (event.button === 0) {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const bounds =
          event.currentTarget.parentElement!.getBoundingClientRect();
        onChange(clamp(((bounds.right - event.clientX) / bounds.width) * 100));
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
    />
  );
}
