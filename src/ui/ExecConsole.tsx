import { useRef, useState } from "react";
import { Trash2, Terminal, Copy } from "lucide-react";
import type { Connection, DockerClient } from "../domain/types";
import {
  interactiveCommand,
  validateExecInput,
  type Shell,
} from "../domain/exec";
export function ExecConsole({
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
  onBusyChange: (busy: boolean) => void;
  state: string;
}) {
  const [input, setInput] = useState(""),
    [output, setOutput] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  const [shell, setShell] = useState<Shell>("sh"),
    [error, setError] = useState(""),
    [copyStatus, setCopyStatus] = useState("");
  const history = useRef<string[]>([]),
    position = useRef(0),
    lock = useRef(false);
  const submit = async () => {
    if (lock.current || !input.trim() || !running || disabled) return;
    try {
      validateExecInput(input);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Invalid command.");
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    const command = input;
    setInput("");
    history.current = [...history.current, command].slice(-50);
    position.current = history.current.length;
    setOutput((previous) => [...previous, `$ ${command}`].slice(-30));
    try {
      const result = await client.exec(id, command, context, shell);
      if (result.exitCode)
        setError(
          result.exitCode === 126 || result.exitCode === 127
            ? "The command or selected shell is unavailable in this container. Try another shell or check the output below."
            : `Command exited with code ${result.exitCode}. See its output below.`,
        );
      setOutput((previous) =>
        [
          ...previous,
          `${result.text}${result.truncated ? "\n[Output truncated]" : ""}${result.exitCode ? `\nExit code: ${result.exitCode}` : ""}`,
        ].slice(-30),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed";
      setError(
        /permission|grant|denied|capability/i.test(message)
          ? `${message} Check Docker Manager’s permissions in Plugins; command execution and confirmation must be allowed.`
          : message,
      );
      setOutput((previous) =>
        [
          ...previous,
          error instanceof Error ? error.message : "Command failed",
        ].slice(-30),
      );
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  };
  return (
    <div className="exec">
      <div className="exec-heading">
        <Terminal size={14} />
        <strong>Container shell commands</strong>
        <button
          aria-label="Clear command output"
          disabled={busy}
          onClick={() => setOutput([])}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <p className="hint">
        Run a command inside this container. Commands have a 20-second limit;
        interactive programs need a regular terminal.
      </p>
      <div className="shell-tools">
        <label>
          Shell
          <select
            aria-label="Container shell"
            value={shell}
            disabled={busy || disabled}
            onChange={(e) => setShell(e.target.value as Shell)}
          >
            <option value="sh">sh</option>
            <option value="bash">bash</option>
          </select>
        </label>
        <button
          disabled={!running}
          onClick={async () => {
            try {
              if (!navigator.clipboard) throw new Error();
              await navigator.clipboard.writeText(
                interactiveCommand(id, shell),
              );
              setCopyStatus("Copied. Paste into a terminal on this server.");
            } catch {
              setCopyStatus("Select and copy the command below.");
            }
          }}
        >
          <Copy size={13} />
          Copy interactive shell
        </button>
      </div>
      <div className="interactive-shell">
        <code>{interactiveCommand(id, shell)}</code>
        {copyStatus && <small role="status">{copyStatus}</small>}
      </div>
      {!running && (
        <p className="inline-error">
          {state === "restarting"
            ? "This container is restarting. Exec becomes available when it is running."
            : state === "paused"
              ? "Unpause this container before running a command."
              : "Start this container before running a command."}
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="console exec-output" aria-live="polite">
        {output.length
          ? output.map((entry, i) => <pre key={i}>{entry}</pre>)
          : "Run a command to inspect this container."}
        {busy && <p>Waiting for confirmation or command output…</p>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <span>$</span>
        <input
          aria-label="Shell command"
          placeholder="e.g. pwd"
          maxLength={1000}
          value={input}
          disabled={busy || !running || disabled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              position.current = Math.max(
                0,
                Math.min(
                  history.current.length,
                  position.current + (e.key === "ArrowUp" ? -1 : 1),
                ),
              );
              setInput(history.current[position.current] || "");
            }
          }}
        />
        <button
          type="submit"
          disabled={busy || !running || disabled || !input.trim()}
        >
          Run
        </button>
      </form>
    </div>
  );
}
