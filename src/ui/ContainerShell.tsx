import { useState } from "react";
import { Copy, Terminal } from "lucide-react";
import type { Connection, DockerClient } from "../domain/types";
import { interactiveCommand, type Shell } from "../domain/exec";
import { Select } from "./Select";
import { ContainerTerminal } from "./ContainerTerminal";
import { copyText } from "./copyText";

/** Interactive-only shell UI; the copied command never executes in the plugin. */
export function ContainerShell({
  client,
  id,
  context,
  running,
  disabled,
  onBusyChange,
  state,
}: {
  client: DockerClient;
  id: string;
  context: Connection;
  running: boolean;
  disabled: boolean;
  onBusyChange(busy: boolean): void;
  state: string;
}) {
  const [shell, setShell] = useState<Shell>("sh");
  const [copyStatus, setCopyStatus] = useState("");
  return (
    <div className="exec">
      <ContainerTerminal
        client={client}
        id={id}
        context={context}
        shell={shell}
        running={running}
        disabled={disabled}
        onBusyChange={onBusyChange}
        controls={
          <>
            <span className="shell-title">
              <Terminal size={14} aria-hidden="true" />
              <strong>Terminal</strong>
            </span>
            <label className="shell-picker">
              <Select
                aria-label="Container shell"
                value={shell}
                disabled={disabled}
                onChange={(event) => {
                  setShell(event.target.value as Shell);
                  setCopyStatus("");
                }}
              >
                <option value="sh">sh</option>
                <option value="bash">bash</option>
              </Select>
            </label>
            <details
              className="interactive-shell shell-fallback"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector("summary")?.focus();
                }
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  event.currentTarget.open = false;
              }}
            >
              <summary
                aria-label="Use a separate terminal"
                data-tooltip="Use a separate terminal"
              >
                <Copy size={14} />
              </summary>
              <div className="shell-fallback-content">
                <button
                  disabled={!running || disabled}
                  onClick={async (event) => {
                    const copied = await copyText(
                      interactiveCommand(id, shell),
                      event.currentTarget.parentElement!,
                    );
                    setCopyStatus(
                      copied
                        ? "Copied. Paste into this server's terminal."
                        : "Copy was blocked. Select the command and press Ctrl+C (Cmd+C on macOS).",
                    );
                  }}
                >
                  <Copy size={13} />
                  Copy shell command
                </button>
                <code>{interactiveCommand(id, shell)}</code>
                {copyStatus && (
                  <small role="status" className="hint">
                    {copyStatus}
                  </small>
                )}
              </div>
            </details>
          </>
        }
      />
      {!running && (
        <p className="inline-error">
          {state === "paused"
            ? "Unpause this container before opening a shell."
            : "Wait until this container is running before opening a shell."}
        </p>
      )}
    </div>
  );
}
