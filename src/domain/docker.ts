import type {
  Container,
  HostInfo,
  Inspection,
  Metric,
  Resource,
  Section,
} from "./types";
export type { Container } from "./types";

export function containerId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error("Expected a full Docker container ID.");
  return value;
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid Docker response.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 2048): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}
export function number(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function rows(stdout: string): Record<string, unknown>[] {
  if (stdout.length > 2 * 1024 * 1024)
    throw new Error("Docker response exceeds its size limit.");
  const lines = stdout.split("\n").filter((line) => line.trim());
  if (lines.length > 500)
    throw new Error("Docker returned more than 500 objects.");
  return lines.map((line) => record(JSON.parse(line)));
}
export function parseContainers(stdout: string): Container[] {
  return rows(stdout).map((data) => ({
    id: containerId(data.ID),
    name: text(data.Names),
    image: text(data.Image),
    state: text(data.State),
    status: text(data.Status),
    ports: text(data.Ports),
    networks: [
      ...new Set(
        text(data.Networks)
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
      ),
    ].slice(0, 64),
    project:
      text(data.Labels)
        .split(",")
        .find((label) => label.startsWith("com.docker.compose.project="))
        ?.split("=")[1] || "standalone",
    health: /\(unhealthy\)/.test(text(data.Status))
      ? "unhealthy"
      : /\(healthy\)/.test(text(data.Status))
        ? "healthy"
        : "",
  }));
}
export function parseInfo(stdout: string): {
  host: HostInfo;
  daemonId: string;
} {
  const data = record(JSON.parse(stdout));
  const daemonId = text(data.ID, 256);
  if (!daemonId) throw new Error("Docker daemon identity is unavailable.");
  return {
    daemonId,
    host: {
      name: text(data.Name, 256),
      version: text(data.ServerVersion, 100),
      os: text(data.OperatingSystem, 256),
      cpus: number(data.NCPU),
      memory: number(data.MemTotal),
    },
  };
}
export function parseMetrics(stdout: string): Metric[] {
  return rows(stdout).map((data) => ({
    id: containerId(data.ID || data.Container),
    cpu: number(text(data.CPUPerc).replace("%", "")),
    memory: number(text(data.MemPerc).replace("%", "")),
    memoryText: text(data.MemUsage),
    net: text(data.NetIO),
    block: text(data.BlockIO),
    pids: text(data.PIDs),
  }));
}
export function parseInspection(
  stdout: string,
  expectedId: string,
): Inspection {
  const list: unknown = JSON.parse(stdout);
  if (!Array.isArray(list) || list.length !== 1)
    throw new Error("Container was not found. Refresh and select it again.");
  const data = record(list[0]);
  if (containerId(data.Id) !== expectedId)
    throw new Error("Container identity changed.");
  const config = record(data.Config || {});
  const state = record(data.State || {});
  const network = record(data.NetworkSettings || {});
  const environment = Array.isArray(config.Env)
    ? config.Env.slice(0, 200).map((value) => text(value, 2048))
    : [];
  const ports = Object.entries(record(network.Ports || {}))
    .slice(0, 200)
    .flatMap(([port, bindings]) =>
      Array.isArray(bindings)
        ? bindings.slice(0, 20).map((binding) => {
            const b = record(binding);
            return `${text(b.HostIp)}:${text(b.HostPort)} → ${port}`;
          })
        : [`${port} (not published)`],
    );
  const mounts = Array.isArray(data.Mounts)
    ? data.Mounts.slice(0, 200).map((item) => {
        const m = record(item);
        return `${text(m.Source)} → ${text(m.Destination)} (${text(m.Type)}, ${m.RW ? "read/write" : "read-only"})`;
      })
    : [];
  return {
    id: expectedId,
    name: text(data.Name).replace(/^\//, ""),
    image: text(config.Image),
    state: text(state.Status),
    health: state.Health ? text(record(state.Health).Status) : "",
    created: text(data.Created),
    started: text(state.StartedAt),
    restartCount: number(data.RestartCount),
    environment,
    ports,
    mounts,
  };
}
export function parseResources(
  stdout: string,
  section: Exclude<Section, "containers">,
): Resource[] {
  return rows(stdout).map((data) =>
    section === "images"
      ? {
          id: `${text(data.ID)}:${text(data.Repository)}:${text(data.Tag)}`,
          name: text(data.Repository),
          values: [text(data.Tag), text(data.Size), text(data.CreatedSince)],
        }
      : section === "volumes"
        ? {
            id: text(data.Name),
            name: text(data.Name),
            values: [
              text(data.Driver),
              text(data.Scope) || "local",
              text(data.Mountpoint) || "—",
            ],
          }
        : {
            id: text(data.ID),
            name: text(data.Name),
            values: [
              text(data.Driver),
              text(data.Scope),
              text(data.ID).slice(0, 12),
            ],
          },
  );
}
