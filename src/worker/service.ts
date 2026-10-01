import type { ZyncWorkerApi } from "@zync-sh/plugin-sdk/worker";
import {
  parseContainers,
  parseInfo,
  parseInspection,
  parseMetrics,
  parseResources,
} from "../domain/docker";
import type { Request } from "../domain/protocol";
import type { TextResult } from "../domain/types";
import { containerTerminalLaunch } from "../domain/exec";
import { errorMessage } from "../domain/errors";
import { allowsAction } from "../domain/actions";

export class DockerError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
function failure(stderr: string, exitCode: number): DockerError {
  if (/permission denied/i.test(stderr))
    return new DockerError(
      "The SSH user cannot access Docker. Check the server’s Docker permissions.",
      "permission",
    );
  if (exitCode === 127 || /docker.*not found/i.test(stderr))
    return new DockerError(
      "Docker is not installed or is not available in this SSH session’s PATH.",
      "unavailable",
    );
  if (
    /cannot connect|is the docker daemon running|connection refused/i.test(
      stderr,
    )
  )
    return new DockerError(
      "The Docker daemon is unavailable. Start Docker on the server, then retry.",
      "unavailable",
    );
  return new DockerError(
    `Docker returned exit code ${exitCode}. Refresh and check the container state before retrying.`,
    "failed",
  );
}
function textResult(
  stdout: string,
  stderr: string,
  exitCode?: number,
): TextResult {
  const content = (stdout + (stderr ? "\n" + stderr : "")).replace(
    /\x1b\[[0-?]*[ -/]*[@-~]/g,
    "",
  );
  return {
    text: content.slice(-48000),
    truncated: content.length > 48000,
    updatedAt: Date.now(),
    exitCode,
  };
}

export async function queryDocker(
  api: ZyncWorkerApi,
  paneId: string,
  request: Request,
): Promise<unknown> {
  if (request.type === "terminal" && !api.sshTerminal)
    return { supported: false };
  let token = request.type === "snapshot" ? undefined : request.connectionToken;
  const run = async (args: string[], allowFailure = false) => {
    const result = await api.sshCommand.execute(paneId, {
      program: "docker",
      args,
      ...(token ? { expectedConnectionToken: token } : {}),
    });
    token = result.connectionToken;
    if (result.exitCode !== 0 && !allowFailure)
      throw failure(result.stderr, result.exitCode);
    return result;
  };
  const verifyDaemon = async () => {
    const info = parseInfo(
      (await run(["info", "--format", "{{json .}}"])).stdout,
    );
    if (request.type !== "snapshot" && info.daemonId !== request.daemonId)
      throw new DockerError(
        "Docker daemon changed. Refresh before continuing.",
        "disconnected",
      );
    return info;
  };
  const info = await verifyDaemon();
  if (request.type === "snapshot") {
    const containers = parseContainers(
      (await run(["ps", "--all", "--no-trunc", "--format", "{{json .}}"]))
        .stdout,
    );
    return {
      ...info,
      containers,
      connectionToken: token,
      updatedAt: Date.now(),
    };
  }
  if (request.type === "metrics")
    return parseMetrics(
      (
        await run([
          "stats",
          "--all",
          "--no-stream",
          "--no-trunc",
          "--format",
          "{{json .}}",
        ])
      ).stdout,
    );
  if (request.type === "resources") {
    const args =
      request.section === "images"
        ? ["image", "ls", "--no-trunc"]
        : request.section === "volumes"
          ? ["volume", "ls"]
          : ["network", "ls", "--no-trunc"];
    return parseResources(
      (await run([...args, "--format", "{{json .}}"])).stdout,
      request.section,
    );
  }
  const inspect = async (id: string) =>
    parseInspection((await run(["container", "inspect", id])).stdout, id);
  if (request.type === "inspect") return inspect(request.id);
  if (request.type === "logs") {
    const response = await run([
      "logs",
      "--tail",
      "400",
      "--timestamps",
      request.id,
    ]);
    return textResult(response.stdout, response.stderr);
  }
  if (request.type === "terminal") {
    const terminal = api.sshTerminal!;
    // Capture the host lease before reads. Reconnects must not retarget this offer.
    const captured = await terminal.context(paneId);
    if (captured.connectionToken !== request.connectionToken)
      throw new DockerError(
        "Connection changed. Refresh before opening a terminal.",
        "disconnected",
      );
    await verifyDaemon();
    if ((await inspect(request.id)).state !== "running")
      throw new DockerError(
        "Start the container before opening a terminal.",
        "failed",
      );
    const offer = await terminal.prepare(
      paneId,
      containerTerminalLaunch(
        request.id,
        request.shell,
        captured.connectionToken,
      ),
    );
    return { supported: true, ...offer };
  }
  const targets = [];
  for (const id of request.ids) targets.push(await inspect(id));
  if (targets.some((target) => !allowsAction(request.action, target.state)))
    throw new DockerError(
      `Selected containers cannot ${request.action} in their current state. Refresh before continuing.`,
      "failed",
    );
  if (
    request.action === "remove" &&
    targets.some(
      (target) => !["exited", "created", "dead"].includes(target.state),
    )
  )
    throw new DockerError(
      "Stop selected containers before removing them.",
      "failed",
    );
  const warning =
    request.action === "remove"
      ? "Permanently removes the container writable layers. Named volumes remain intact."
      : request.action === "stop" || request.action === "restart"
        ? "This may interrupt running services and active requests."
        : "These containers will start on this server.";
  const accepted = await api.ui.confirm({
    title: `${request.action[0].toUpperCase() + request.action.slice(1)} ${targets.length} container${targets.length === 1 ? "" : "s"}?`,
    message: `Server: ${info.host.name}\n${warning}\n\n${targets.map((target) => `${target.name.slice(0, 80)} (${target.id.slice(0, 12)})`).join("\n")}`,
    confirmLabel:
      request.action === "remove" ? "Remove containers" : "Continue",
  });
  if (!accepted) return { canceled: true, completed: [] };
  await verifyDaemon();
  const completed: string[] = [];
  for (const target of targets) {
    try {
      const current = await inspect(target.id);
      if (!allowsAction(request.action, current.state))
        throw new Error(
          "Container state changed while confirming. Refresh before retrying.",
        );
      const args =
        request.action === "remove"
          ? ["rm", target.id]
          : request.action === "start"
            ? ["start", target.id]
            : [request.action, "--time", "10", target.id];
      await run(args);
      completed.push(target.id);
    } catch (error) {
      return {
        canceled: false,
        completed,
        failed: `${target.name}: ${errorMessage(error)} The last operation may have an uncertain outcome; refresh before retrying.`,
      };
    }
  }
  return { canceled: false, completed };
}
