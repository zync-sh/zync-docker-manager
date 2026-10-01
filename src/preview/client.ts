import type {
  Container,
  DockerClient,
  Inspection,
  Metric,
  Resource,
  Section,
} from "../domain/types";
import { RequestError } from "../ui/client";
export type PreviewState =
  | "connected"
  | "loading"
  | "empty"
  | "disconnected"
  | "permission"
  | "unavailable"
  | "failed";
export interface PreviewClient extends DockerClient {
  setState(state: PreviewState): void;
}

export function createPreviewClient(): PreviewClient {
  let state: PreviewState = "connected";
  const names = [
    "zync-api",
    "postgres-main",
    "redis-cache",
    "traefik",
    "vector-agent",
    "worker-email",
    "worker-index",
    "minio",
    "grafana",
    "prometheus",
    "clickhouse",
    "backup-nightly",
  ];
  let containers: Container[] = names.map((name, index) => ({
    id: (index + 10).toString(16).padStart(64, "a"),
    name,
    image: [
      "ghcr.io/zync/api:2.4.1",
      "postgres:16-alpine",
      "redis:7.4-alpine",
      "traefik:v3.2",
    ][index % 4],
    state: [5, 8, 11].includes(index) ? "exited" : "running",
    status: [5, 8, 11].includes(index)
      ? "Exited (0) 2 hours ago"
      : `Up ${index + 1} days`,
    health: index === 4 ? "unhealthy" : "healthy",
    ports: "127.0.0.1:8080 → 8080/tcp",
    project: [4, 8, 9].includes(index)
      ? "monitoring"
      : [7, 11].includes(index)
        ? "standalone"
        : "zync-stack",
    networks:
      index === 0
        ? ["zync_frontend", "zync_backend"]
        : [4, 8, 9].includes(index)
          ? ["monitoring"]
          : index === 7
            ? ["host"]
            : index === 11
              ? []
              : ["zync_backend"],
  }));
  const check = async () => {
    await new Promise((resolve) =>
      setTimeout(resolve, state === "loading" ? 2500 : 100),
    );
    const errors: Partial<Record<PreviewState, string>> = {
      disconnected: "The SSH connection was interrupted.",
      permission: "Your remote user cannot access Docker.",
      unavailable: "Docker is not installed or its daemon is not responding.",
      failed: "Docker returned an unexpected response.",
    };
    if (errors[state]) throw new RequestError(errors[state]!, state);
  };
  const find = (id: string) => {
    const item = containers.find((row) => row.id === id);
    if (!item) throw new Error("Container no longer exists.");
    return item;
  };
  const resourceRows: Record<Exclude<Section, "containers">, Resource[]> = {
    images: [
      "ghcr.io/zync/api",
      "postgres",
      "redis",
      "traefik",
      "grafana/grafana",
    ].map((name, index) => ({
      id: `image-${index}`,
      name,
      values: [
        ["2.4.1", "16-alpine", "7.4-alpine", "v3.2", "11.4"][index],
        `${[842, 392, 117, 184, 612][index]} MB`,
        `${index + 2} days ago`,
      ],
    })),
    volumes: [
      "postgres_data",
      "grafana_storage",
      "zync_uploads",
      "redis_data",
    ].map((name) => ({ id: name, name, values: ["local", "local", "—"] })),
    networks: ["zync_frontend", "zync_backend", "host", "none"].map(
      (name, index) => ({
        id: `network-${index}`,
        name,
        values: [
          index < 2 ? "bridge" : name === "host" ? "host" : "null",
          "local",
          `a340f65${index}5fa4`,
        ],
      }),
    ),
  };
  return {
    setState(value) {
      state = value;
    },
    async snapshot() {
      await check();
      return {
        containers:
          state === "empty" ? [] : containers.map((row) => ({ ...row })),
        host: {
          name: "prod-01",
          version: "27.4.1",
          os: "Ubuntu 24.04",
          cpus: 8,
          memory: 16 * 1024 ** 3,
        },
        connectionToken: "preview-connection",
        daemonId: "preview-daemon",
        updatedAt: Date.now(),
      };
    },
    async metrics() {
      await check();
      return containers.map((row, index): Metric => ({
        id: row.id,
        cpu:
          row.state === "running"
            ? Number(
                (
                  0.4 +
                  index * 0.73 +
                  Math.sin(Date.now() / 5000 + index) * 0.2
                ).toFixed(1),
              )
            : 0,
        memory: row.state === "running" ? 12 + index * 6 : 0,
        memoryText: `${128 + index * 37} MiB / 2 GiB`,
        net: "12 MB / 8 MB",
        block: "2 MB / 1 MB",
        pids: "8",
      }));
    },
    async inspect(id) {
      await check();
      const row = find(id);
      return {
        ...row,
        created: "2026-09-20T09:00:00Z",
        started: "2026-09-24T10:00:00Z",
        restartCount: 0,
        environment: [
          "NODE_ENV=production",
          `SERVICE_NAME=${row.name}`,
          "LOG_LEVEL=info",
          "TZ=UTC",
          "API_TOKEN=preview-only-value",
        ],
        ports: [row.ports],
        mounts: [
          `/srv/${row.name}/data → /data (bind, read/write)`,
          "/etc/localtime → /etc/localtime (bind, read-only)",
        ],
      } as Inspection;
    },
    async logs(id) {
      await check();
      find(id);
      return {
        text: Array.from(
          { length: 90 },
          (_, index) =>
            `${new Date().toISOString()} ${index % 11 === 0 ? "ERROR failed to publish event topic=index.updates" : index % 7 === 0 ? "WARN upstream response slower than threshold" : `INFO request completed method=GET path=/v1/health status=200 request=${index + 1}`}`,
        ).join("\n"),
        truncated: false,
        updatedAt: Date.now(),
      };
    },
    async resources(section) {
      await check();
      return state === "empty" ? [] : resourceRows[section];
    },
    async action(action, ids) {
      await check();
      if (!window.confirm(`${action} ${ids.length} simulated container(s)?`))
        return { canceled: true, completed: [] };
      containers =
        action === "remove"
          ? containers.filter((row) => !ids.includes(row.id))
          : containers.map((row) =>
              ids.includes(row.id)
                ? {
                    ...row,
                    state: action === "stop" ? "exited" : "running",
                    status:
                      action === "stop"
                        ? "Exited (0) just now"
                        : "Up a few seconds",
                  }
                : row,
            );
      return { canceled: false, completed: ids };
    },
    dispose() {},
  };
}
