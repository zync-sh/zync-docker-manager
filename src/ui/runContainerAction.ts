import type {
  Action,
  ActionResult,
  Connection,
  DockerClient,
} from "../domain/types";

/** Keep each confirmation small; cancellation or failure stops remaining batches. */
export async function runContainerAction(
  client: DockerClient,
  action: Action,
  ids: string[],
  context: Connection,
  onProgress: (completed: number, total: number) => void,
): Promise<ActionResult> {
  const targets = [...new Set(ids)];
  const completed: string[] = [];

  for (let offset = 0; offset < targets.length; offset += 5) {
    onProgress(completed.length, targets.length);
    let result: ActionResult;
    try {
      result = await client.action(
        action,
        targets.slice(offset, offset + 5),
        context,
      );
    } catch (error) {
      return {
        canceled: false,
        completed,
        failed: `${error instanceof Error ? error.message : "Action failed."} This batch may have an uncertain outcome; refresh before retrying. Remaining batches were not started.`,
      };
    }
    completed.push(...result.completed);
    if (result.canceled || result.failed) return { ...result, completed };
  }

  return { canceled: false, completed };
}
