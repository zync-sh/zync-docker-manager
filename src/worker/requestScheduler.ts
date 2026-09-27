export interface SchedulerClock {
  now(): number;
  wait(milliseconds: number): Promise<void>;
}

const clock: SchedulerClock = {
  now: () => Date.now(),
  wait: (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

/** Shared by all panes: pace privileged calls without retrying uncertain mutations. */
export function createRequestScheduler(intervalMs = 1000, timer = clock) {
  let tail: Promise<unknown> = Promise.resolve();
  let nextStart = 0;

  return function schedule<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail
      .catch(() => {})
      .then(async () => {
        const delay = nextStart - timer.now();
        if (delay > 0) await timer.wait(delay);
        try {
          return await operation();
        } finally {
          // Completion checks also consume host budget. Space from completion,
          // not just dispatch, so long-running commands cannot create bursts.
          nextStart = timer.now() + intervalMs;
        }
      });
    tail = result;
    return result;
  };
}
