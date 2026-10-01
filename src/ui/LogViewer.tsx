import { useEffect, useRef, useState } from "react";
import { Search, RefreshCw, Copy, ArrowDownToLine } from "lucide-react";
import { usePaneVisibility } from "./usePaneVisibility";
import { Select } from "./Select";
import type { Connection, DockerClient, TextResult } from "../domain/types";
export function LogViewer({
  client,
  id,
  context,
}: {
  client: DockerClient;
  id: string;
  context: Connection;
}) {
  const visible = usePaneVisibility();
  const [result, setResult] = useState<TextResult>(),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [live, setLive] = useState(true),
    [retry, setRetry] = useState(0);
  const [wrap, setWrap] = useState(true);
  const [timestamps, setTimestamps] = useState(true);
  const [following, setFollowing] = useState(true);
  const [feedback, setFeedback] = useState("");
  const scroll = useRef<HTMLDivElement>(null),
    follow = useRef(true);
  useEffect(() => {
    if (!visible) return;
    let active = true,
      pending = false;
    const update = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const value = await client.logs(id, context);
        if (active) {
          setResult(value);
          setError("");
        }
      } catch (failure) {
        if (active)
          setError(
            failure instanceof Error ? failure.message : "Logs unavailable",
          );
      } finally {
        pending = false;
      }
    };
    void update();
    const timer = live ? setInterval(() => void update(), 5000) : undefined;
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [
    client,
    id,
    context.connectionToken,
    context.daemonId,
    live,
    retry,
    visible,
  ]);
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [result]);
  const lines = (result?.text || "")
    .split("\n")
    .filter((line, index, all) => line !== "" || index < all.length - 1)
    .filter(
      (line) =>
        line.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "all" ||
          (filter === "errors"
            ? /error|fatal|exception/i.test(line)
            : /warn/i.test(line))),
    );
  const displayed = lines.map((line) =>
    timestamps
      ? line
      : line.replace(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\s/,
          "",
        ),
  );
  return (
    <div className="logs">
      <div className="log-tools">
        <label className="search">
          <Search size={13} />
          <input
            aria-label="Search logs"
            placeholder="Filter logs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Select
          aria-label="Log level"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All levels</option>
          <option value="errors">Errors</option>
          <option value="warnings">Warnings</option>
        </Select>
        <button
          aria-pressed={live}
          onClick={() => setLive(!live)}
          className={live ? "live" : ""}
        >
          Live
        </button>
        <button
          aria-label="Refresh logs"
          onClick={() => setRetry((n) => n + 1)}
        >
          <RefreshCw size={13} />
        </button>
      </div>
      <div className="log-options" aria-label="Log display options">
        <button aria-pressed={wrap} onClick={() => setWrap(!wrap)}>
          Wrap
        </button>
        <button
          aria-pressed={timestamps}
          onClick={() => setTimestamps(!timestamps)}
        >
          Timestamps
        </button>
        <button
          aria-label="Follow latest logs"
          aria-pressed={following}
          onClick={() => {
            follow.current = true;
            setFollowing(true);
            if (scroll.current)
              scroll.current.scrollTop = scroll.current.scrollHeight;
          }}
        >
          <ArrowDownToLine size={14} />
          Follow
        </button>
        <button
          aria-label="Copy displayed logs"
          data-tooltip="Copy displayed logs"
          disabled={!displayed.length}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(displayed.join("\n"));
              setFeedback("Displayed logs copied.");
            } catch {
              setFeedback(
                "Clipboard unavailable. Select the logs and copy manually.",
              );
            }
          }}
        >
          <Copy size={14} />
        </button>
      </div>
      {feedback && (
        <p className="log-feedback" role="status">
          {feedback}
        </p>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div
        className={`console log-lines ${wrap ? "" : "no-wrap"}`}
        tabIndex={0}
        aria-label="Container log output"
        ref={scroll}
        onScroll={() => {
          const el = scroll.current;
          if (el) {
            follow.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            setFollowing(follow.current);
          }
        }}
      >
        {!result
          ? "Loading logs…"
          : !result.text
            ? "No recent logs."
            : !displayed.length
              ? "No logs match your filters."
              : displayed.map((line, i) => (
                  <div
                    key={i}
                    className={
                      /error|fatal|exception/i.test(line)
                        ? "negative"
                        : /warn/i.test(line)
                          ? "warning"
                          : ""
                    }
                  >
                    {line || "\u00a0"}
                  </div>
                ))}
      </div>
      <div className="console-footer">
        {lines.length} lines · {live ? "refreshing every 5s" : "paused"}
        {result?.truncated && " · older output omitted"}
      </div>
    </div>
  );
}
