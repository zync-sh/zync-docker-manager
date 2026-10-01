import { useEffect, useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import { LoadingState } from "./LoadingState";
import type {
  DockerClient,
  Resource,
  Section,
  Connection,
} from "../domain/types";
export function ResourceView({
  client,
  section,
  context,
}: {
  client: DockerClient;
  section: Exclude<Section, "containers">;
  context: Connection;
}) {
  const [items, setItems] = useState<Resource[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    client
      .resources(section, context)
      .then(
        (value) => {
          if (active) setItems(value);
        },
        (failure) => {
          if (active) setError(String(failure.message));
        },
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, section, context, retry]);
  const columns =
    section === "images"
      ? ["Repository", "Tag", "Size", "Created"]
      : section === "volumes"
        ? ["Name", "Driver", "Scope", "Mountpoint"]
        : ["Name", "Driver", "Scope", "ID"];
  const filtered = items.filter((item) =>
    `${item.name} ${item.values.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="resources">
      <div className="resource-toolbar">
        <label className="search">
          <Search size={14} />
          <input
            aria-label={`Search ${section}`}
            placeholder={`Search ${section}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span className="muted">
          {loading ? "Loading…" : `${filtered.length} ${section}`}
        </span>
        <button
          aria-label={`Refresh ${section}`}
          disabled={loading}
          onClick={() => setRetry((n) => n + 1)}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      {error ? (
        <div className="empty" role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>Retry</button>
        </div>
      ) : loading ? (
        <LoadingState title={`Reading Docker ${section}…`} compact />
      ) : (
        <>
          <div className="resource-grid table-heading">
            {columns.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          {filtered.map((item) => (
            <div className="resource-grid resource-row" key={item.id}>
              <strong>{item.name}</strong>
              {item.values.map((value, i) => (
                <span key={i} data-tooltip={value}>
                  {value}
                </span>
              ))}
            </div>
          ))}
          {!filtered.length && (
            <div className="empty">
              <Search size={24} />
              <h3>
                {items.length ? "No matching resources" : `No ${section} found`}
              </h3>
              <p>
                {items.length
                  ? "Try a different search."
                  : `This daemon has no ${section} to display.`}
              </p>
              {search && (
                <button onClick={() => setSearch("")}>Clear search</button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
