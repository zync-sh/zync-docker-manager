import { useEffect, useState } from "react";

const memory = new Map<string, unknown>();

/** Store presentation preferences only; opaque plugin origins use a memory fallback. */
export function useViewPreference<T>(
  key: string,
  initial: T,
  valid: (value: unknown) => value is T,
) {
  const storageKey = `zync.docker.view.${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(storageKey) ?? "null",
      );
      if (valid(saved)) return saved;
    } catch {
      /* Storage may be unavailable in a sandboxed pane. */
    }
    const saved = memory.get(storageKey);
    return valid(saved) ? saved : initial;
  });
  useEffect(() => {
    memory.set(storageKey, value);
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch {
        /* Keep the pane usable without persistent storage. */
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [storageKey, value]);
  return [value, setValue] as const;
}
