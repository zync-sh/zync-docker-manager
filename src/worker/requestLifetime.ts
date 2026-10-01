import type { ZyncWorkerApi } from "@zync-sh/plugin-sdk/worker";
import { requestTimeout } from "../domain/requestTimeout";
import { createRequestScheduler } from "./requestScheduler";

export function requestDeadline(
  message: unknown,
  type: string,
  now = Date.now(),
): number {
  const supplied = (message as { deadlineAt?: unknown }).deadlineAt;
  if (
    supplied !== undefined &&
    (typeof supplied !== "number" || !Number.isFinite(supplied))
  ) {
    throw new Error("Invalid request deadline.");
  }
  return Math.min(
    typeof supplied === "number" ? supplied : Infinity,
    now + requestTimeout(type),
  );
}

export function createRequestApi(
  api: ZyncWorkerApi,
  schedule: ReturnType<typeof createRequestScheduler>,
  deadline: number,
  signal: AbortSignal,
  now = () => Date.now(),
): ZyncWorkerApi {
  const check = () => {
    if (signal.aborted || now() >= deadline)
      throw new Error(
        "Request expired or canceled. Refresh before retrying; an already dispatched command may have completed.",
      );
  };
  return {
    ...api,
    ...(api.sshTerminal
      ? {
          sshTerminal: {
            context: async (pane: string) => {
              check();
              const result = await api.sshTerminal!.context(pane);
              check();
              return result;
            },
            prepare: async (
              ...args: Parameters<
                NonNullable<ZyncWorkerApi["sshTerminal"]>["prepare"]
              >
            ) => {
              check();
              const result = await api.sshTerminal!.prepare(...args);
              check();
              return result;
            },
          },
        }
      : {}),
    sshCommand: {
      ...api.sshCommand,
      execute: (...args) =>
        schedule(async () => {
          check();
          const result = await api.sshCommand.execute(...args);
          check();
          return result;
        }),
    },
    ui: {
      ...api.ui,
      confirm: async (...args) => {
        // Pace dispatch only. A person considering approval must not hold the
        // shared SSH queue hostage. Never consume a late approval after expiry.
        let approval: Promise<boolean> | undefined;
        await schedule(async () => {
          check();
          approval = api.ui.confirm(...args);
          void approval.catch(() => {});
        });
        check();
        const result = await new Promise<boolean>((resolve, reject) => {
          const aborted = () =>
            reject(new Error("Request expired or canceled."));
          signal.addEventListener("abort", aborted, { once: true });
          approval!
            .then(resolve, reject)
            .finally(() => signal.removeEventListener("abort", aborted))
            .catch(() => {});
          if (signal.aborted) aborted();
        });
        check();
        return result;
      },
    },
  };
}
