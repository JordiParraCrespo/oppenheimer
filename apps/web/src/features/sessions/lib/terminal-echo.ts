import type { Terminal } from '@xterm/xterm';
import { EchoLatency } from './echo-latency';
import { bindLatencyReadout } from './latency-readout';
import type { TerminalRendererKind } from './terminal-renderer';
import { readTerminalTheme } from './terminal-theme';
import { bindTypeahead } from './typeahead';

/**
 * Below this keystroke round trip a prediction is not drawn: the host's own
 * echo lands within a frame or two, and a guess could only add a flicker.
 * VS Code's terminal typeahead uses the same threshold.
 */
const TYPEAHEAD_MIN_LATENCY_MS = 30;

export interface TerminalEchoOptions {
  /** A watcher's pane: nothing it sends is predicted. */
  readOnly: boolean;
  /** Whether predictions may draw: the `terminal_typeahead` flag. */
  typeahead: () => boolean;
  /** Which renderer draws the grid, for predictions to be drawn the way it draws. */
  renderer: () => TerminalRendererKind;
  /** Which path the stream's bytes take, for the readout (`SessionStream.onPath`). */
  onPath?: (listener: (path: string) => void) => () => void;
  /** Where the latency readout is published (`bindLatencyReadout`); none without it. */
  latencyKey?: string;
}

/**
 * The path a reader's bytes take to the host and the echo back: every byte the
 * pane sends goes through `send`, which times the round trip (`EchoLatency`)
 * and lets predictive echo (`typeahead.ts`) guess before the bytes leave;
 * `received` is told when output arrives. The latency readout lives here too.
 * The rest of the terminal never needs to know any of it is there.
 */
export function bindTerminalEcho(
  term: Terminal,
  transmit: (data: string) => void,
  options: TerminalEchoOptions,
): {
  send(data: string): void;
  received(): void;
  repaint(): void;
  dispose(): void;
} {
  const latency = new EchoLatency();
  const typeahead = options.readOnly
    ? null
    : bindTypeahead(term, {
        shouldDraw: () =>
          options.typeahead() && (latency.quantile(0.5) ?? 0) >= TYPEAHEAD_MIN_LATENCY_MS,
        readColors: readTypeaheadColors,
        renderer: options.renderer,
        onConfirm: (ms) => latency.add(ms),
        // A guess the host has not confirmed in a few round trips was wrong.
        timeoutMs: () => Math.max(1000, 4 * (latency.quantile(0.95) ?? 0)),
      });
  let path: string | null = null;
  const offPath = options.onPath?.((next) => {
    path = next;
  });
  const unbindReadout = options.latencyKey
    ? bindLatencyReadout(options.latencyKey, latency, () => path)
    : () => {};

  return {
    send(data) {
      if (!isTerminalReport(data)) latency.sent(performance.now());
      // A report (a wheel notch, focus) makes the program repaint, which voids
      // any guess; the model reads it as a key it cannot predict.
      typeahead?.input(data);
      transmit(data);
    },
    received() {
      latency.received(performance.now());
    },
    repaint() {
      typeahead?.repaint();
    },
    dispose() {
      offPath?.();
      unbindReadout();
      typeahead?.dispose();
    },
  };
}

/**
 * What xterm sends on the reader's behalf rather than as a key: focus in and
 * out (tmux runs `focus-events on`) and mouse reports. The program may answer
 * none of them, so none of them starts a latency sample.
 */
function isTerminalReport(data: string): boolean {
  return data.length > 2 && data.startsWith('\u001b[') && 'IO<M'.includes(data.charAt(2));
}

/** The terminal ramp as a predicted cell is drawn in it. */
function readTypeaheadColors() {
  const theme = readTerminalTheme();
  return {
    background: theme.background ?? 'transparent',
    foreground: theme.foreground ?? 'currentColor',
    cursor: theme.cursor ?? theme.foreground ?? 'currentColor',
    cursorText: theme.cursorAccent ?? theme.background ?? 'transparent',
  };
}
