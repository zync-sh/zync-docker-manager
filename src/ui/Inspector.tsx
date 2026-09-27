import { useEffect, useState } from "react";
import {
  ArrowLeft,
  X,
  Play,
  Square,
  RotateCw,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Cpu,
  MemoryStick,
} from "lucide-react";
import type {
  Action,
  Container,
  DetailTab,
  DockerClient,
  Inspection,
  Metric,
  Snapshot,
} from "../domain/types";
import { LogViewer } from "./LogViewer";
import { ExecConsole } from "./ExecConsole";
import { LoadingState } from "./LoadingState";

function Values({
  values,
  secret = false,
}: {
  values: string[];
  secret?: boolean;
}) {
  const [revealed, setRevealed] = useState<number[]>([]),
    [copied, setCopied] = useState<number>(),
    [error, setError] = useState("");
  return (
    <div className="values">
      {!values.length && <p className="hint">No entries reported by Docker.</p>}
      {values.map((entry, i) => {
        const separator = secret ? entry.indexOf("=") : -1;
        const key = separator >= 0 ? entry.slice(0, separator) : "";
        const value = separator >= 0 ? entry.slice(separator + 1) : entry;
        const shown = secret && !revealed.includes(i) ? "••••••••" : value;
        return (
          <div className="value-row" key={i}>
            <div>
              {key && <strong>{key}</strong>}
              <code>{shown}</code>
            </div>
            {secret && (
              <button
                aria-label={`${revealed.includes(i) ? "Hide" : "Reveal"} ${key}`}
                onClick={() =>
                  setRevealed((previous) =>
                    previous.includes(i)
                      ? previous.filter((n) => n !== i)
                      : [...previous, i],
                  )
                }
              >
                {revealed.includes(i) ? (
                  <EyeOff size={13} />
                ) : (
                  <Eye size={13} />
                )}
              </button>
            )}
            <button
              aria-label={`Copy ${key || "value"}`}
              title={copied === i ? "Copied" : "Copy displayed value"}
              onClick={async () => {
                try {
                  if (!navigator.clipboard)
                    throw new Error("Clipboard unavailable");
                  await navigator.clipboard.writeText(shown);
                  setCopied(i);
                  setError("");
                } catch {
                  setCopied(undefined);
                  setError(
                    "Clipboard unavailable. Select and copy the value manually.",
                  );
                }
              }}
            >
              <Copy size={13} />
            </button>
          </div>
        );
      })}
      {copied !== undefined && (
        <small role="status">Copied displayed value.</small>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function Chart({ values, label }: { values: number[]; label: string }) {
  const top = Math.max(100, ...values);
  const points = values
    .map(
      (v, i) =>
        `${(i * 100) / Math.max(1, values.length - 1)},${38 - Math.min(v / top, 1) * 34}`,
    )
    .join(" ");
  return (
    <div className="chart">
      <span>{label}</span>
      <svg
        viewBox="0 0 100 42"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}, ${values.length} recent samples`}
      >
        <path d="M0 38H100" className="chart-baseline" />
        {values.length > 1 && <polyline points={points} />}
      </svg>
      <small>
        {values.length < 2
          ? "Collecting samples…"
          : "Recent samples · 5s cadence"}
      </small>
    </div>
  );
}
export function Inspector({
  client,
  container,
  context,
  metric,
  history,
  onClose,
  onAction,
  disabled,
  onBusyChange,
}: {
  client: DockerClient;
  container: Container;
  context: Snapshot;
  metric?: Metric;
  history: Metric[];
  onClose: () => void;
  onAction: (action: Action, ids: string[]) => void;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("overview"),
    [details, setDetails] = useState<Inspection>(),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setDetails(undefined);
    setError("");
    client.inspect(container.id, context).then(
      (value) => {
        if (active) setDetails(value);
      },
      (failure) => {
        if (active) setError(failure.message);
      },
    );
    return () => {
      active = false;
    };
  }, [client, container.id, context, retry]);
  const tabs: [DetailTab, string][] = [
    ["overview", "Overview"],
    ["logs", "Logs"],
    ["exec", "Exec / Shell"],
    ["environment", "Environment"],
    ["ports", "Ports"],
    ["mounts", "Mounts"],
  ];
  return (
    <aside className="inspector" aria-label={`${container.name} details`}>
      <header className="inspector-heading">
        <button className="back" onClick={onClose}>
          <ArrowLeft size={14} />
          Back
        </button>
        <div>
          <h2>
            <i
              className={`state-dot ${container.state === "running" ? "positive" : ""}`}
            />
            {container.name}
          </h2>
          <code>{container.id.slice(0, 12)}</code>
        </div>
        <button aria-label="Close inspector" onClick={onClose}>
          <X size={16} />
        </button>
      </header>
      <div className="container-actions">
        <button
          disabled={disabled}
          onClick={() =>
            onAction(container.state === "running" ? "stop" : "start", [
              container.id,
            ])
          }
        >
          {container.state === "running" ? (
            <Square size={13} />
          ) : (
            <Play size={13} />
          )}{" "}
          {container.state === "running" ? "Stop" : "Start"}
        </button>
        <button
          disabled={disabled}
          onClick={() => onAction("restart", [container.id])}
        >
          <RotateCw size={13} />
          Restart
        </button>
        <button
          className="danger-icon"
          aria-label="Remove container"
          title={
            container.state === "running"
              ? "Stop the container before removing it"
              : "Remove container (volumes are kept)"
          }
          disabled={
            disabled || !["exited", "created", "dead"].includes(container.state)
          }
          onClick={() => onAction("remove", [container.id])}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <nav className="detail-tabs" aria-label="Container details">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            aria-current={tab === value ? "page" : undefined}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div
        className={`inspector-content ${tab === "logs" || tab === "exec" ? "console-content" : ""}`}
      >
        {tab === "logs" ? (
          <LogViewer
            key={container.id}
            client={client}
            id={container.id}
            context={context}
          />
        ) : tab === "exec" ? (
          <ExecConsole
            key={container.id}
            client={client}
            id={container.id}
            context={context}
            running={container.state === "running"}
            state={container.state}
            disabled={disabled}
            onBusyChange={onBusyChange}
          />
        ) : error ? (
          <div className="empty" role="alert">
            <p>{error}</p>
            <button onClick={() => setRetry((n) => n + 1)}>
              Retry inspection
            </button>
          </div>
        ) : !details ? (
          <LoadingState title="Reading container details…" compact />
        ) : tab === "overview" ? (
          <>
            <div className="metrics">
              <div>
                <span>
                  <Cpu size={13} />
                  CPU
                </span>
                <strong>{metric ? `${metric.cpu.toFixed(1)}%` : "—"}</strong>
                <progress max="100" value={Math.min(metric?.cpu || 0, 100)} />
              </div>
              <div>
                <span>
                  <MemoryStick size={13} />
                  MEMORY
                </span>
                <strong>{metric?.memoryText.split("/")[0] || "—"}</strong>
                <progress
                  max="100"
                  value={Math.min(metric?.memory || 0, 100)}
                />
              </div>
            </div>
            <div className="charts">
              <Chart label="CPU usage" values={history.map((m) => m.cpu)} />
              <Chart
                label="Memory usage"
                values={history.map((m) => m.memory)}
              />
            </div>
            <dl className="details">
              {[
                ["Image", details.image],
                ["Status", container.status],
                ["Health", details.health || "No health check"],
                ["Created", details.created],
                ["Started", details.started],
                ["Restarts", String(details.restartCount)],
                ["Network I/O", metric?.net || "—"],
                ["Block I/O", metric?.block || "—"],
                ["Processes", metric?.pids || "—"],
              ].map(([name, value]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <Values
            key={`${container.id}:${tab}`}
            values={details[tab]}
            secret={tab === "environment"}
          />
        )}
      </div>
    </aside>
  );
}
