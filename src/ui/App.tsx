import { useRef, useState } from "react";
import {
  Container as ContainerIcon,
  Layers,
  HardDrive,
  Network,
  RefreshCw,
  AlertCircle,
  Sun,
  Moon,
  X,
} from "lucide-react";
import type { Action, DockerClient, Section } from "../domain/types";
import type { PreviewClient, PreviewState } from "../preview/client";
import { useWorkspace } from "./useWorkspace";
import { ContainerList } from "./ContainerList";
import { Inspector } from "./Inspector";
import { ResourceView } from "./ResourceView";
import { DockerIcon } from "./DockerIcon";
import { LoadingState } from "./LoadingState";

export function App({
  client,
  preview,
}: {
  client: DockerClient;
  preview: boolean;
}) {
  const [section, setSection] = useState<Section>("containers"),
    [selected, setSelected] = useState<string>(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [light, setLight] = useState(false);
  const actionLock = useRef(false);
  const workspace = useWorkspace(client, busy);
  const { snapshot, loading, error, refresh, metrics, history } = workspace;
  const container = snapshot?.containers.find((c) => c.id === selected);
  const disabled = busy || loading || !!error || !snapshot;
  const action = async (operation: Action, ids: string[]) => {
    if (disabled || actionLock.current || !snapshot) return;
    actionLock.current = true;
    setBusy(true);
    setNotice("Waiting for confirmation…");
    try {
      const result = await client.action(operation, ids, snapshot);
      setNotice(
        result.canceled
          ? "Action canceled."
          : result.failed ||
              `${operation[0].toUpperCase() + operation.slice(1)} completed for ${result.completed.length} container(s).`,
      );
      if (!result.canceled) await refresh();
    } catch (failure) {
      setNotice(failure instanceof Error ? failure.message : "Action failed.");
      await refresh();
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  const sections = [
    ["containers", "Containers", ContainerIcon],
    ["images", "Images", Layers],
    ["volumes", "Volumes", HardDrive],
    ["networks", "Networks", Network],
  ] as const;
  return (
    <div
      className="docker-host"
      data-theme={preview ? (light ? "light" : "dark") : undefined}
    >
      <main className="workspace">
        <header className="workspace-header">
          <div className="brand-icon">
            <DockerIcon />
          </div>
          <div className="brand">
            <div>
              <h1>Docker</h1>
              <span className={`connection-badge ${error ? "warning" : ""}`}>
                {error
                  ? "Unavailable"
                  : loading
                    ? "Syncing"
                    : snapshot
                      ? "Connected"
                      : "Connecting"}
              </span>
            </div>
            <small>
              {snapshot?.host.name || "Connecting to pane server…"}
              {preview ? " · preview" : ""}
            </small>
          </div>
          <div className="header-tools">
            {preview && (
              <>
                <select
                  aria-label="Preview state"
                  defaultValue="connected"
                  onChange={(e) => {
                    (client as PreviewClient).setState(
                      e.target.value as PreviewState,
                    );
                    setSelected(undefined);
                    void refresh();
                  }}
                >
                  {[
                    "connected",
                    "empty",
                    "loading",
                    "disconnected",
                    "permission",
                    "unavailable",
                    "failed",
                  ].map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
                <button
                  aria-label="Toggle preview theme"
                  onClick={() => setLight(!light)}
                >
                  {light ? <Moon size={15} /> : <Sun size={15} />}
                </button>
              </>
            )}
            <button
              aria-label="Refresh Docker"
              title="Refresh Docker"
              disabled={busy || loading}
              onClick={() => void refresh()}
            >
              <RefreshCw size={15} className={loading ? "spinning" : ""} />
            </button>
          </div>
        </header>
        <nav className="resource-tabs" aria-label="Docker resources">
          {sections.map(([value, label, Icon]) => (
            <button
              key={value}
              aria-current={section === value ? "page" : undefined}
              onClick={() => setSection(value)}
            >
              <Icon size={15} />
              {label}
              {value === "containers" && snapshot && (
                <span className="count">{snapshot.containers.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="workspace-body">
          {loading && snapshot && (
            <div className="refresh-progress" role="status">
              {workspace.slowLoading
                ? "Still refreshing Docker…"
                : "Refreshing Docker…"}
              <span aria-hidden="true" />
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={13} />
              </button>
            </div>
          )}
          {error ? (
            <div className="empty" role="alert">
              <AlertCircle size={28} />
              <h2>
                {error.code === "permission"
                  ? "Docker permission required"
                  : error.code === "unavailable"
                    ? "Docker is unavailable"
                    : error.code === "disconnected"
                      ? "Server disconnected"
                      : "Unable to load Docker"}
              </h2>
              <p>{error.message}</p>
              <button onClick={() => void refresh()}>Try again</button>
            </div>
          ) : !snapshot ? (
            <LoadingState slow={workspace.slowLoading} />
          ) : section === "containers" ? (
            <div
              className={`container-workspace ${container ? "has-inspector" : ""}`}
            >
              <ContainerList
                containers={snapshot.containers}
                metrics={metrics}
                selected={selected}
                onSelect={setSelected}
                disabled={disabled}
                onAction={(operation, ids) => void action(operation, ids)}
              />
              {container && (
                <Inspector
                  key={container.id}
                  client={client}
                  container={container}
                  context={snapshot}
                  metric={metrics.find((m) => m.id === container.id)}
                  history={history[container.id] || []}
                  onClose={() => setSelected(undefined)}
                  disabled={disabled}
                  onBusyChange={setBusy}
                  onAction={(operation, ids) => void action(operation, ids)}
                />
              )}
            </div>
          ) : (
            <ResourceView
              client={client}
              section={section}
              context={snapshot}
            />
          )}
        </div>
        <footer className="workspace-footer">
          <span>
            <i className={`state-dot ${error ? "warning" : "positive"}`} />
            {busy
              ? "Action in progress"
              : workspace.metricError ||
                (snapshot
                  ? `${snapshot.containers.filter((c) => c.state === "running").length} running · ${snapshot.containers.length} containers`
                  : "Connecting…")}
          </span>
          <button
            aria-pressed={workspace.autoRefresh}
            onClick={() => workspace.setAutoRefresh(!workspace.autoRefresh)}
            title="Toggle metric refresh"
          >
            {workspace.autoRefresh ? "Live metrics" : "Metrics paused"}
          </button>
          <span>Docker {snapshot?.host.version || "—"}</span>
        </footer>
      </main>
    </div>
  );
}
