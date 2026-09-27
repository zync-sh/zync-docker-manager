import { useCallback, useEffect, useRef, useState } from "react";
import type { DockerClient, Metric, Snapshot } from "../domain/types";
import { RequestError } from "./client";
import { usePaneVisibility } from "./usePaneVisibility";
export interface Failure {
  message: string;
  code: string;
}
export const toFailure = (error: unknown): Failure => ({
  message: error instanceof Error ? error.message : "Request failed.",
  code: error instanceof RequestError ? error.code : "failed",
});

export function useWorkspace(client: DockerClient, busy: boolean) {
  const visible = usePaneVisibility();
  const lastRefresh = useRef(0);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [loading, setLoading] = useState(true);
  const [slowLoading, setSlowLoading] = useState(false);
  const [error, setError] = useState<Failure>();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [metricError, setMetricError] = useState("");
  const [history, setHistory] = useState<Record<string, Metric[]>>({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const generation = useRef(0);
  const identity = useRef("");
  const blocked = useRef(busy);
  blocked.current = busy;
  useEffect(() => {
    setSlowLoading(false);
    if (!loading) return;
    const timer = setTimeout(() => setSlowLoading(true), 5000);
    return () => clearTimeout(timer);
  }, [loading]);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(undefined);
    try {
      const value = await client.snapshot();
      if (current === generation.current) {
        const nextIdentity = JSON.stringify([
          value.connectionToken,
          value.daemonId,
        ]);
        if (identity.current !== nextIdentity) {
          setMetrics([]);
          setHistory({});
          identity.current = nextIdentity;
        }
        setSnapshot(value);
        lastRefresh.current = Date.now();
      }
    } catch (failure) {
      if (current === generation.current) setError(toFailure(failure));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [client]);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current += 1;
    };
  }, [refresh]);
  useEffect(() => {
    if (
      visible &&
      autoRefresh &&
      !busy &&
      snapshot &&
      Date.now() - lastRefresh.current >= 30000
    ) {
      void refresh();
    }
  }, [visible, autoRefresh, busy, refresh]);
  useEffect(() => {
    if (!visible || !snapshot || error) return;
    let disposed = false,
      running = false;
    const update = async () => {
      if (running || blocked.current || document.hidden) return;
      running = true;
      try {
        const values = await client.metrics(snapshot);
        if (!disposed) {
          setMetrics(values);
          setMetricError("");
          setHistory((previous) =>
            Object.fromEntries(
              values.map((value) => [
                value.id,
                [...(previous[value.id] || []), value].slice(-12),
              ]),
            ),
          );
        }
      } catch (failure) {
        if (!disposed) setMetricError(toFailure(failure).message);
      } finally {
        running = false;
      }
    };
    void update();
    const timer = autoRefresh
      ? setInterval(() => void update(), 5000)
      : undefined;
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [
    client,
    snapshot?.connectionToken,
    snapshot?.daemonId,
    snapshot?.updatedAt,
    autoRefresh,
    error,
    visible,
  ]);
  return {
    snapshot,
    loading,
    slowLoading,
    error,
    refresh,
    metrics,
    metricError,
    history,
    autoRefresh,
    setAutoRefresh,
  };
}
