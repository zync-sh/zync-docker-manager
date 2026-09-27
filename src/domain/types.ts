export type Section = "containers" | "images" | "volumes" | "networks";
import type { Shell } from "./exec";
export type Action = "start" | "stop" | "restart" | "remove";
export type Grouping = "compose" | "network" | "none";
export type DetailTab =
  "overview" | "logs" | "exec" | "environment" | "ports" | "mounts";
export interface Container {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string;
  project: string;
  networks: string[];
  health: string;
}
export interface Connection {
  connectionToken: string;
  daemonId: string;
}
export interface HostInfo {
  name: string;
  version: string;
  os: string;
  cpus: number;
  memory: number;
}
export interface Snapshot extends Connection {
  containers: Container[];
  host: HostInfo;
  updatedAt: number;
}
export interface Metric {
  id: string;
  cpu: number;
  memory: number;
  memoryText: string;
  net: string;
  block: string;
  pids: string;
}
export interface Inspection {
  id: string;
  name: string;
  image: string;
  state: string;
  health: string;
  created: string;
  started: string;
  restartCount: number;
  environment: string[];
  ports: string[];
  mounts: string[];
}
export interface Resource {
  id: string;
  name: string;
  values: string[];
}
export interface TextResult {
  text: string;
  truncated: boolean;
  updatedAt: number;
  exitCode?: number;
}
export interface ActionResult {
  canceled: boolean;
  completed: string[];
  failed?: string;
}
export interface DockerClient {
  snapshot(): Promise<Snapshot>;
  metrics(context: Connection): Promise<Metric[]>;
  inspect(id: string, context: Connection): Promise<Inspection>;
  logs(id: string, context: Connection): Promise<TextResult>;
  resources(
    section: Exclude<Section, "containers">,
    context: Connection,
  ): Promise<Resource[]>;
  action(
    action: Action,
    ids: string[],
    context: Connection,
  ): Promise<ActionResult>;
  exec(
    id: string,
    input: string,
    context: Connection,
    shell?: Shell,
  ): Promise<TextResult>;
  dispose(): void;
}
