import type { EchoLatency } from './echo-latency';

/**
 * The switch for the readout, per browser: set this `localStorage` key to `1`
 * and reload. A measuring tool for whoever is tuning the terminal, so it is
 * neither a setting nor a flag.
 */
const LATENCY_READOUT_KEY = 'oppenheimer.terminal.latency';

const REFRESH_MS = 500;

function readoutWanted(): boolean {
  try {
    return localStorage.getItem(LATENCY_READOUT_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The keystroke round trip, drawn in the pane's top-right corner as
 * `echo p50 / p95 ms · samples`, over `host` (xterm's root, which is
 * positioned), when `LATENCY_READOUT_KEY` asks for it. Returns its
 * disposer; a no-op when the readout is off.
 */
export function bindLatencyReadout(host: HTMLElement, latency: EchoLatency): () => void {
  if (!readoutWanted()) return () => {};
  const readout = document.createElement('div');
  readout.setAttribute('aria-hidden', 'true');
  readout.dataset.testid = 'terminal-latency';
  readout.style.cssText = [
    'position:absolute',
    'top:4px',
    'right:8px',
    'z-index:7',
    'pointer-events:none',
    'font:11px ui-monospace, monospace',
    'padding:1px 6px',
    'border-radius:4px',
    'background:var(--term-bg)',
    'color:var(--term-dim)',
    'opacity:0.85',
  ].join(';');
  host.appendChild(readout);

  const render = () => {
    const p50 = latency.quantile(0.5);
    const p95 = latency.quantile(0.95);
    readout.textContent =
      p50 === null || p95 === null
        ? 'echo –'
        : `echo ${Math.round(p50)} / ${Math.round(p95)} ms · ${latency.count}`;
  };
  render();
  const timer = setInterval(render, REFRESH_MS);
  return () => {
    clearInterval(timer);
    readout.remove();
  };
}
