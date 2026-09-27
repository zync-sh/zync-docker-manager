import { useEffect, useRef, useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import { usePaneVisibility } from "./usePaneVisibility";
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
  }, [client, id, context, live, retry, visible]);
  useEffect(() => {
    if (follow.current && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [result]);
  const lines = (result?.text || "")
    .split("\n")
    .filter(
      (line) =>
        line.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "all" ||
          (filter === "errors"
            ? /error|fatal|exception/i.test(line)
            : /warn/i.test(line))),
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
        <select
          aria-label="Log level"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All levels</option>
          <option value="errors">Errors</option>
          <option value="warnings">Warnings</option>
        </select>
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
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div
        className="console log-lines"
        ref={scroll}
        onScroll={() => {
          const el = scroll.current;
          if (el)
            follow.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {!result
          ? "Loading logs…"
          : !result.text
            ? "No recent logs."
            : lines.map((line, i) => (
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
