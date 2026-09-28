import { useSyncExternalStore } from 'react';

/**
 * The time, as a timestamp that moves every `intervalMs`.
 *
 * For anything that renders relative to now — "5m" beside a session, a
 * countdown. Reading `Date.now()` or `new Date()` during render instead looks
 * the same and is wrong: the React Compiler caches the result on the inputs it
 * can see, so an age computed from `createdAt` alone stops moving until
 * something unrelated changes. Passing this value in makes the clock an input.
 *
 * The outside system is the timer, and there is one per interval, shared by
 * every reader: forty groups on a minute clock are one `setInterval` and one
 * batched commit, not forty. So put the hook in the lowest component that reads
 * the time — every tick re-renders the component that owns it — without
 * weighing how many of them there are.
 */
export function useNow(intervalMs: number): number {
  const clock = clockFor(intervalMs);
  return useSyncExternalStore(clock.subscribe, clock.read, clock.read);
}

interface Clock {
  subscribe: (listener: () => void) => () => void;
  read: () => number;
}

const clocks = new Map<number, Clock>();

/** The shared clock for one interval: it ticks while anything reads it. */
function clockFor(intervalMs: number): Clock {
  const existing = clocks.get(intervalMs);
  if (existing) return existing;

  const listeners = new Set<() => void>();
  let now = Date.now();
  let timer: ReturnType<typeof setInterval> | undefined;

  const clock: Clock = {
    subscribe(listener) {
      listeners.add(listener);
      if (!timer) {
        now = Date.now();
        // The timer: one tick per interval for every reader, cleared when the
        // last one unmounts.
        timer = setInterval(() => {
          now = Date.now();
          for (const notify of listeners) notify();
        }, intervalMs);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    read() {
      // An idle clock catches up once a whole interval has gone by, so the
      // first reader after a pause does not start from an old time; between
      // two reads it returns the same value, as a snapshot must.
      if (!timer && Math.abs(Date.now() - now) >= intervalMs) now = Date.now();
      return now;
    },
  };
  clocks.set(intervalMs, clock);
  return clock;
}
