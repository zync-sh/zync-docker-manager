import type { Container, Grouping } from "./types";

/** A container can appear in multiple network groups; selection stays ID-based. */
export function groupContainers(
  containers: Container[],
  grouping: Grouping,
): Map<string, Container[]> {
  const groups = new Map<string, Container[]>();
  for (const container of containers) {
    const names =
      grouping === "none"
        ? [""]
        : grouping === "compose"
          ? [container.project]
          : container.networks.length
            ? container.networks
            : ["No network"];
    for (const name of new Set(names))
      groups.set(name, [...(groups.get(name) || []), container]);
  }
  return groups;
}
