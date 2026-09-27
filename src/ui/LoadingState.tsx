import { DockerIcon } from "./DockerIcon";

export function LoadingState({
  title = "Reading Docker containers…",
  slow = false,
  compact = false,
}: {
  title?: string;
  slow?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`loading-state ${compact ? "compact" : ""}`}
      role="status"
      aria-busy="true"
    >
      <div className="loading-symbol" aria-hidden="true">
        <DockerIcon />
      </div>
      <h2>{title}</h2>
      {!compact && (
        <p>
          {slow
            ? "This server is taking longer to respond. You can keep this pane open while it loads."
            : "Reading the Docker state on this pane’s server."}
        </p>
      )}
      <div className="loading-skeleton" aria-hidden="true">
        {[0, 1, 2].map((n) => (
          <div key={n}>
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}
