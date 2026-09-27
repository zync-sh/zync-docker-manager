import {
  Layers,
  Network,
  ChevronDown,
  ChevronRight,
  Search,
  Play,
  Square,
  RotateCw,
  X,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type { Action, Container, Metric, Grouping } from "../domain/types";
import { groupContainers } from "../domain/grouping";
import { Select } from "./Select";
import { allowsAction } from "../domain/actions";

export function ContainerList({
  containers,
  metrics,
  selected,
  onSelect,
  onAction,
  disabled,
}: {
  containers: Container[];
  metrics: Metric[];
  selected?: string;
  onSelect: (id: string) => void;
  onAction: (action: Action, ids: string[]) => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [checked, setChecked] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [grouping, setGrouping] = useState<Grouping>("compose");
  const visible = containers.filter(
    (c) =>
      `${c.name} ${c.image} ${c.project} ${c.networks.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "running"
          ? c.state === "running"
          : ["exited", "created", "dead"].includes(c.state))),
  );
  const groups = groupContainers(visible, grouping);
  const picked = checked.filter((id) => containers.some((c) => c.id === id));
  const removable = picked.filter((id) =>
    containers.some((c) => c.id === id && allowsAction("remove", c.state)),
  );
  const toggle = (ids: string[]) =>
    setChecked((previous) =>
      ids.every((id) => previous.includes(id))
        ? previous.filter((id) => !ids.includes(id))
        : [...new Set([...previous, ...ids])],
    );
  return (
    <section className="container-list" aria-label="Containers">
      <div className="list-tools">
        <label className="search">
          <Search size={14} />
          <input
            aria-label="Search containers"
            placeholder="Search containers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="segments">
          {["all", "running", "stopped"].map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <label className="grouping-control">
          <span>Group by</span>
          <Select
            aria-label="Group containers by"
            value={grouping}
            onChange={(e) => {
              setGrouping(e.target.value as Grouping);
              setCollapsed([]);
            }}
          >
            <option value="compose">Compose project</option>
            <option value="network">Network</option>
            <option value="none">None</option>
          </Select>
        </label>
      </div>
      {picked.length > 0 && (
        <div className="batch">
          <span>{picked.length} selected</span>
          {(["start", "stop", "restart"] as const).map((action, i) => {
            const Icon = [Play, Square, RotateCw][i];
            const eligible = picked.filter((id) =>
              containers.some(
                (c) => c.id === id && allowsAction(action, c.state),
              ),
            );
            return (
              <button
                key={action}
                data-tooltip={`${action} ${eligible.length} eligible container(s)`}
                aria-label={`${action} selected containers`}
                disabled={disabled || !eligible.length}
                onClick={() => onAction(action, eligible)}
              >
                <Icon size={14} />
              </button>
            );
          })}
          <button
            className="danger-icon"
            aria-label="Remove selected stopped containers"
            data-tooltip={
              removable.length
                ? `Remove ${removable.length} stopped container(s); volumes are kept`
                : "Stop containers before removing them"
            }
            disabled={disabled || !removable.length}
            onClick={() => onAction("remove", removable)}
          >
            <Trash2 size={14} />
          </button>
          <button aria-label="Clear selection" onClick={() => setChecked([])}>
            <X size={14} />
          </button>
          <small>
            {picked.length > 5 ? "Confirmed in batches of up to 5. " : ""}
            Removal applies only to stopped containers; volumes are kept.
          </small>
        </div>
      )}
      <div className="table-heading container-row">
        <span />
        <span>NAME</span>
        <span className="image-column">IMAGE</span>
        <span>STATUS</span>
        <span>CPU / RAM</span>
      </div>
      <div className="list-scroll">
        {[...groups].map(([project, items]) => (
          <div key={project}>
            {grouping !== "none" && (
              <div className="group-heading">
                <input
                  type="checkbox"
                  aria-label={`Select ${project}`}
                  checked={items.every((c) => picked.includes(c.id))}
                  ref={(el) => {
                    if (el)
                      el.indeterminate =
                        items.some((c) => picked.includes(c.id)) &&
                        !items.every((c) => picked.includes(c.id));
                  }}
                  onChange={() => toggle(items.map((c) => c.id))}
                />
                <button
                  onClick={() =>
                    setCollapsed((previous) =>
                      previous.includes(project)
                        ? previous.filter((p) => p !== project)
                        : [...previous, project],
                    )
                  }
                  aria-expanded={!collapsed.includes(project)}
                >
                  {collapsed.includes(project) ? (
                    <ChevronRight size={13} />
                  ) : (
                    <ChevronDown size={13} />
                  )}
                  {grouping === "network" ? (
                    <Network size={13} />
                  ) : (
                    <Layers size={13} />
                  )}
                  <span>{project}</span>
                </button>
                <small>
                  {items.filter((c) => c.state === "running").length}/
                  {items.length} running
                </small>
              </div>
            )}
            {!collapsed.includes(project) &&
              items.map((c) => {
                const metric = metrics.find((m) => m.id === c.id);
                return (
                  <div
                    key={c.id}
                    className={`container-row ${selected === c.id ? "selected" : ""}`}
                  >
                    <input
                      aria-label={`Select ${c.name}`}
                      type="checkbox"
                      checked={picked.includes(c.id)}
                      onChange={() => toggle([c.id])}
                    />
                    <button
                      className="container-name"
                      onClick={() => onSelect(c.id)}
                    >
                      <strong>{c.name}</strong>
                      <small>{c.image}</small>
                    </button>
                    <span className="image-column" data-tooltip={c.image}>
                      {c.image}
                    </span>
                    <span
                      className={`status ${c.health === "unhealthy" || c.state === "restarting" ? "warning" : c.state === "running" ? "positive" : "muted"}`}
                    >
                      <i />
                      {c.state}
                    </span>
                    <span className="row-metrics">
                      {metric ? (
                        <>
                          {metric.cpu.toFixed(1)}%
                          <small>{metric.memory.toFixed(1)}% RAM</small>
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                );
              })}
          </div>
        ))}
        {visible.length === 0 && (
          <div className="empty">
            <Search />
            <h3>No containers found</h3>
            <p>
              {containers.length
                ? "Try another search or filter."
                : "Containers on this Docker daemon will appear here."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
