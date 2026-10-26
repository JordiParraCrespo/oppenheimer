import type { EchoLatency } from './echo-latency';

/**
 * The switch for the readout, per browser: set this `localStorage` key to `1`
 * and reload. A measuring tool for whoever is tuning the terminal, so it is
 * neither a setting nor a flag.
 */
const LATENCY_READOUT_KEY = 'oppenheimer.terminal.latency';

const REFRESH_MS = 500;

const readouts = new Map<string, string>();
const listeners = new Set<(key: string) => void>();

function readoutWanted(): boolean {
  try {
    return localStorage.getItem(LATENCY_READOUT_KEY) === '1';
  } catch {
    return false;
  }
}

function publish(key: string, text: string | undefined): void {
  if (readouts.get(key) === text) return;
  if (text === undefined) readouts.delete(key);
  else readouts.set(key, text);
  for (const listener of listeners) listener(key);
}

/** The readout last published under `key`, if its terminal is measuring. */
export function latencyReadout(key: string): string | undefined {
  return readouts.get(key);
}

export function subscribeLatencyReadouts(listener: (key: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The keystroke round trip as `echo p50 / p95 ms · samples · path`,
 * published under `key` (the session) for the session's bar to draw
 * (`useLatencyReadout`), when `LATENCY_READOUT_KEY` asks for it. Returns its
 * disposer; a no-op when the readout is off.
 */
export function bindLatencyReadout(
  key: string,
  latency: EchoLatency,
  /** The path the bytes take (`relay`, `direct`), when the stream says. */
  path: () => string | null = () => null,
): () => void {
  if (!readoutWanted()) return () => {};
  const render = () => {
    const p50 = latency.quantile(0.5);
    const p95 = latency.quantile(0.95);
    const echo =
      p50 === null || p95 === null
        ? 'echo –'
        : `echo ${Math.round(p50)} / ${Math.round(p95)} ms · ${latency.count}`;
    const via = path();
    publish(key, via ? `${echo} · ${via}` : echo);
  };
  render();
  const timer = setInterval(render, REFRESH_MS);
  return () => {
    clearInterval(timer);
    publish(key, undefined);
  };
}
