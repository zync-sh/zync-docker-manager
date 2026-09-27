import { useEffect, useState } from "react";
import { Search } from "lucide-react";
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
  return (
    <section className="resources">
      <label className="search">
        <Search size={14} />
        <input
          aria-label={`Search ${section}`}
          placeholder={`Search ${section}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
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
          {items
            .filter((item) =>
              `${item.name} ${item.values.join(" ")}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((item) => (
              <div className="resource-grid resource-row" key={item.id}>
                <strong>{item.name}</strong>
                {item.values.map((value, i) => (
                  <span key={i} data-tooltip={value}>
                    {value}
                  </span>
                ))}
              </div>
            ))}
          {!items.length && (
            <div className="empty">No {section} found on this daemon.</div>
          )}
        </>
      )}
    </section>
  );
}
