/**
 * The PTY's size, told once a drag has settled rather than on every frame of it.
 *
 * Every resize reaches the program as a SIGWINCH, and an agent answers one by
 * redrawing its whole screen: a window edge dragged across a second was dozens
 * of full redraws racing each other through the link. `02-runner.md` §5 caps
 * this at a coalesce over 50 ms; the console holds a little longer, because
 * the grid on screen refits at once and only the far end waits. Synara lands
 * on 120 ms for the same reason.
 *
 * The first size goes straight out — it is the viewport the attach is opened
 * with — and a size equal to the last one sent is not sent again.
 */
export const RESIZE_SETTLE_MS = 100;

export interface ResizeCoalescer {
  request(cols: number, rows: number): void;
  dispose(): void;
}

export function createResizeCoalescer(
  send: (cols: number, rows: number) => void,
  options: {
    settleMs?: number;
    /** Injected in tests; `setTimeout` otherwise. */
    schedule?: (fn: () => void, ms: number) => () => void;
  } = {},
): ResizeCoalescer {
  const settleMs = options.settleMs ?? RESIZE_SETTLE_MS;
  const schedule =
    options.schedule ??
    ((fn, ms) => {
      const timer = setTimeout(fn, ms);
      return () => clearTimeout(timer);
    });

  let sent: { cols: number; rows: number } | null = null;
  let pending: { cols: number; rows: number } | null = null;
  let cancel: (() => void) | null = null;

  const flush = () => {
    cancel = null;
    if (!pending) return;
    const next = pending;
    pending = null;
    if (sent && sent.cols === next.cols && sent.rows === next.rows) return;
    sent = next;
    send(next.cols, next.rows);
  };

  return {
    request(cols, rows) {
      if (cols < 1 || rows < 1) return;
      pending = { cols, rows };
      if (!sent) {
        flush();
        return;
      }
      cancel?.();
      cancel = schedule(flush, settleMs);
    },
    dispose() {
      cancel?.();
      cancel = null;
      pending = null;
    },
  };
}
