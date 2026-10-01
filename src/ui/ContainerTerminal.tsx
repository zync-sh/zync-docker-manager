import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { mountTerminalSurface } from "@zync-sh/plugin-sdk/terminal";
import { LoaderCircle, RotateCw, X } from "lucide-react";
import type { Connection, DockerClient } from "../domain/types";
import type { Shell } from "../domain/exec";

/** Reserves a slot only. Zync owns the renderer, approval and SSH session. */
export function ContainerTerminal({
  client,
  id,
  context,
  shell,
  running,
  disabled,
  onBusyChange,
  controls,
}: {
  client: DockerClient;
  id: string;
  context: Connection;
  shell: Shell;
  running: boolean;
  disabled: boolean;
  onBusyChange(busy: boolean): void;
  controls?: ReactNode;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const attempted = useRef(false);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const mounted = useRef(false);
  const busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;
  const surface = useRef<ReturnType<typeof mountTerminalSurface> | null>(null);
  const [offer, setOffer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pending.current) busyCallback.current(false);
    };
  }, []);

  useEffect(() => {
    generation.current++;
    attempted.current = false;
    surface.current?.dispose();
    surface.current = null;
    setOffer(null);
    setMessage("");
    return () => {
      generation.current++;
      surface.current?.dispose();
      surface.current = null;
    };
  }, [client, id, context.connectionToken, context.daemonId, shell, running]);

  useEffect(() => {
    if (!offer || !slot.current) return;
    const mounted = mountTerminalSurface(slot.current, offer);
    surface.current = mounted;
    let current = true;
    void mounted.ready.then((ready) => {
      if (current && !ready) {
        setOffer(null);
        setMessage(
          "Embedded terminals are unavailable in this Zync build. Copy the shell command above and paste it into this server's terminal.",
        );
      }
    });
    return () => {
      current = false;
      mounted.dispose();
    };
  }, [offer]);

  const prepare = useCallback(async () => {
    if (pending.current || disabledRef.current || !running) return;
    attempted.current = true;
    if (!client.terminal) {
      setMessage(
        "Embedded terminals require an updated Zync host. Use the copied shell command instead.",
      );
      return;
    }
    const owner = generation.current;
    pending.current = true;
    setBusy(true);
    busyCallback.current(true);
    setMessage("");
    try {
      const result = await client.terminal(id, context, shell);
      if (owner !== generation.current) return;
      if (result.supported) setOffer(result.offerId);
      else
        setMessage(
          "This host does not support embedded terminals. Copy the shell command above and use this server's terminal.",
        );
    } catch (error) {
      if (owner === generation.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not prepare the container terminal.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) {
        setBusy(false);
        busyCallback.current(false);
      }
    }
  }, [client, id, context.connectionToken, context.daemonId, shell, running]);

  // Preflight reserves a proposal only. Never launch or approve a PTY here.
  useEffect(() => {
    if (!attempted.current && !disabled) void prepare();
  }, [prepare, disabled, busy]);

  return (
    <section
      className="container-terminal"
      aria-label="Interactive container terminal"
    >
      <div className="shell-tools">
        {controls}
        {busy && (
          <span className="shell-progress" role="status">
            <LoaderCircle size={13} className="spinning" aria-hidden="true" />
            Preparing…
          </span>
        )}
        {!busy && !offer && attempted.current && (
          <button
            className="shell-session-action"
            data-tooltip="Retry shell"
            aria-label="Retry shell"
            disabled={disabled || !running}
            onClick={() => void prepare()}
          >
            <RotateCw size={14} />
          </button>
        )}
        {offer && (
          <button
            className="shell-session-action"
            aria-label="Close shell"
            data-tooltip="Close shell"
            onClick={() => {
              surface.current?.dispose();
              surface.current = null;
              setOffer(null);
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="hint">
          {message}
        </p>
      )}
      {offer && (
        <div
          ref={slot}
          className="container-terminal-slot"
          aria-label="Zync terminal slot"
        />
      )}
    </section>
  );
}
