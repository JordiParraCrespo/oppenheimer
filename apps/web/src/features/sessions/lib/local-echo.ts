import type { IDisposable, Terminal } from '@xterm/xterm';

/**
 * Local echo, the way mosh does it: a printable key is drawn where the
 * program will echo it the moment it is typed, instead of a relay round trip
 * later, and the prediction is dropped once the grid shows the real thing.
 *
 * A keystroke reaches the host through the API and its echo comes back the
 * same way, so typing waits on two legs of the relay (on the dev deployment,
 * Madrid to Falkenstein and back, twice: well over 100 ms). SSH waits on none.
 *
 * Predictions are never written into xterm's buffer: they are an overlay, so
 * a wrong one leaves nothing behind when it goes. And they are only *shown*
 * once the program has echoed one on this line (a confirmed epoch, in mosh's
 * words), so a password prompt, an editor's normal mode or a key the program
 * swallows is never painted; the first key of a line waits on the real echo.
 */

/** A key typed, not yet seen on the grid: the cell it should land in. */
export interface Prediction {
  x: number;
  y: number;
  char: string;
  at: number;
}

/** What `reconcile` reads of the terminal: the cursor and the cells. */
export interface EchoGrid {
  cursorX: number;
  cursorY: number;
  cols: number;
  char(x: number, y: number): string;
}

/** The floor under the echo deadline, for a link whose round trip is tiny. */
const MIN_EXPIRY_MS = 750;
/** A prediction this many round trips old was not going to be echoed. */
const EXPIRY_RTTS = 3;
/** After a wrong guess, how long typing waits on real echoes again. */
const SUSPEND_MS = 1_000;

/**
 * The bookkeeping, with no terminal in it: what was typed, where it should
 * appear, and whether it has.
 */
export class EchoPredictor {
  private pending: Prediction[] = [];
  /** The program has echoed a prediction since the last reset. */
  private confirmed = false;
  private suspendedUntil = 0;
  /** Smoothed echo latency, from the predictions the grid confirmed. */
  private rtt: number | null = null;

  /** A key the reader typed, as xterm's `onData` hands it over. */
  type(data: string, grid: EchoGrid, now: number): void {
    if (data === '\x7f' || data === '\b') {
      // Typed and erased before the echo arrived: the host will echo both.
      this.pending.pop();
      return;
    }
    if (!isPrintable(data)) {
      // Enter, arrows, a chord, a paste: the program decides what happens to
      // the line, so nothing about it can be guessed.
      this.reset();
      return;
    }
    if (now < this.suspendedUntil) return;
    const last = this.pending.at(-1);
    const x = last ? last.x + 1 : grid.cursorX;
    const y = last ? last.y : grid.cursorY;
    if (x >= grid.cols) {
      // Where a wrapped line continues is the program's to say.
      this.reset();
      return;
    }
    this.pending.push({ x, y, char: data, at: now });
  }

  /**
   * Compares the predictions with the grid after it changed. One the grid
   * shows, with the cursor gone past it, is confirmed; one the cursor passed
   * over something else was a wrong guess; one nobody echoed expires.
   */
  reconcile(grid: EchoGrid, now: number): void {
    while (this.pending.length > 0) {
      const first = this.pending[0] as Prediction;
      const passed = grid.cursorY > first.y || (grid.cursorY === first.y && grid.cursorX > first.x);
      if (!passed) break;
      if (grid.char(first.x, first.y) !== first.char) {
        this.mispredicted(now);
        return;
      }
      this.pending.shift();
      this.confirmed = true;
      const sample = now - first.at;
      this.rtt = this.rtt === null ? sample : this.rtt * 0.8 + sample * 0.2;
    }
    const oldest = this.pending[0];
    if (oldest && now - oldest.at >= this.expiryMs()) this.mispredicted(now);
  }

  /** What to draw: nothing until the program has echoed on this line. */
  visible(): readonly Prediction[] {
    return this.confirmed ? this.pending : [];
  }

  /** When `reconcile` should look again with no new output, or null. */
  deadline(): number | null {
    const oldest = this.pending[0];
    return oldest ? oldest.at + this.expiryMs() : null;
  }

  reset(): void {
    this.pending = [];
    this.confirmed = false;
  }

  private mispredicted(now: number): void {
    this.reset();
    this.suspendedUntil = now + SUSPEND_MS;
  }

  private expiryMs(): number {
    return Math.max(MIN_EXPIRY_MS, (this.rtt ?? 0) * EXPIRY_RTTS);
  }
}

/** One printable ASCII character: the only keys whose echo is a guess worth making. */
function isPrintable(data: string): boolean {
  if (data.length !== 1) return false;
  const code = data.charCodeAt(0);
  return code >= 0x20 && code <= 0x7e;
}

/**
 * Binds an `EchoPredictor` to `term` until disposed: the runtime hands it
 * every key before sending it (`typed`), and a key it sends on its own path
 * (`reset`). The grid is read after each render rather than after each
 * parse, so a prediction is not taken away while a synchronized frame still
 * holds the real character off the screen.
 */
export function bindLocalEcho(
  term: Terminal,
): IDisposable & { typed(data: string): void; reset(): void } {
  const predictor = new EchoPredictor();
  const screen = term.element?.querySelector<HTMLElement>('.xterm-screen');
  const overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  // What the fleet's typing spec times; the grid's own rows are spans too.
  overlay.dataset.localEcho = '';
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:6;';
  screen?.appendChild(overlay);

  const cell = term.buffer.active.getNullCell();
  const grid = (): EchoGrid => {
    const buffer = term.buffer.active;
    return {
      cursorX: buffer.cursorX,
      cursorY: buffer.baseY + buffer.cursorY,
      cols: term.cols,
      char: (x, y) => buffer.getLine(y)?.getCell(x, cell)?.getChars() ?? '',
    };
  };

  const draw = () => {
    const shown = predictor.visible();
    overlay.replaceChildren();
    if (shown.length === 0 || !screen) return;
    const buffer = term.buffer.active;
    const width = screen.clientWidth / term.cols;
    const height = screen.clientHeight / term.rows;
    const { theme, fontFamily, fontSize } = term.options;
    const glyph = (x: number, y: number, text: string, background: string) => {
      const row = y - buffer.viewportY;
      if (row < 0 || row >= term.rows) return;
      const span = document.createElement('span');
      span.textContent = text;
      span.style.cssText =
        `position:absolute;left:${x * width}px;top:${row * height}px;` +
        `width:${width}px;height:${height}px;line-height:${height}px;` +
        `font-family:${fontFamily};font-size:${fontSize}px;white-space:pre;` +
        `color:${theme?.foreground ?? 'inherit'};background:${background};`;
      overlay.appendChild(span);
    };
    const background = theme?.background ?? 'transparent';
    for (const p of shown) glyph(p.x, p.y, p.char, background);
    // The real cursor is still where the echo has got to; the predicted one
    // sits after the last guess, and the first guess covers the real one.
    const last = shown.at(-1) as Prediction;
    if (last.x + 1 < term.cols) glyph(last.x + 1, last.y, ' ', theme?.cursor ?? 'currentColor');
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const settle = () => {
    predictor.reconcile(grid(), performance.now());
    draw();
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const deadline = predictor.deadline();
    if (deadline !== null) {
      timer = setTimeout(settle, Math.max(0, deadline - performance.now()));
    }
  };

  const reset = () => {
    predictor.reset();
    draw();
  };
  const onRender = term.onRender(settle);
  const onResize = term.onResize(reset);
  const onBuffer = term.buffer.onBufferChange(reset);

  return {
    typed(data) {
      predictor.type(data, grid(), performance.now());
      draw();
      if (timer === null && predictor.deadline() !== null) settle();
    },
    reset,
    dispose() {
      if (timer !== null) clearTimeout(timer);
      onRender.dispose();
      onResize.dispose();
      onBuffer.dispose();
      overlay.remove();
    },
  };
}
