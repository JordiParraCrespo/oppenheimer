import './terminal-env';
import { type IBufferCell, Terminal } from '@xterm/headless';

/** A stretch of one line drawn in one style. */
export interface TerminalRun {
  text: string;
  /** An ANSI palette index (0–255), an `#rrggbb`, or null for the default. */
  fg: number | string | null;
  bg: number | string | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
}

export interface TerminalLine {
  /** Where the line is in the buffer: a stable key while it is in scrollback. */
  index: number;
  runs: TerminalRun[];
}

export interface TerminalSnapshot {
  lines: readonly TerminalLine[];
  /** The cursor's line, among `lines`, while the program shows it. */
  cursorLine: number | null;
}

/** How long output gathers before the view redraws: a frame or so, not every write. */
const PUBLISH_EVERY_MS = 32;

/** How much scrollback the phone keeps and draws: a page or two of history, not the host's whole buffer. */
const SCROLLBACK = 400;

const EMPTY: TerminalSnapshot = { lines: [], cursorLine: null };

function colourOf(cell: IBufferCell, which: 'fg' | 'bg'): number | string | null {
  const isDefault = which === 'fg' ? cell.isFgDefault() : cell.isBgDefault();
  if (isDefault) return null;
  const value = which === 'fg' ? cell.getFgColor() : cell.getBgColor();
  const rgb = which === 'fg' ? cell.isFgRGB() : cell.isBgRGB();
  return rgb ? `#${value.toString(16).padStart(6, '0')}` : value;
}

function sameStyle(run: TerminalRun, next: Omit<TerminalRun, 'text'>): boolean {
  return (
    run.fg === next.fg &&
    run.bg === next.bg &&
    run.bold === next.bold &&
    run.dim === next.dim &&
    run.italic === next.italic &&
    run.underline === next.underline
  );
}

/**
 * The session's terminal, kept on the phone: the bytes the stream carries are
 * parsed by xterm's own parser, headless, and read back as lines of styled
 * runs a `Text` can draw. Nothing here knows React; a view subscribes and
 * reads `snapshot()`, which is rebuilt once per parsed write, not per byte.
 */
export class TerminalScreen {
  private readonly term: Terminal;
  private readonly listeners = new Set<() => void>();
  private snap: TerminalSnapshot = EMPTY;
  private stale = true;
  private readonly cell: IBufferCell;
  private pending: ReturnType<typeof setTimeout> | null = null;

  constructor(cols: number, rows: number) {
    this.term = new Terminal({ cols, rows, scrollback: SCROLLBACK, allowProposedApi: true });
    this.cell = this.term.buffer.active.getNullCell();
    this.term.onWriteParsed(() => this.publish());
  }

  get cols(): number {
    return this.term.cols;
  }

  get rows(): number {
    return this.term.rows;
  }

  /** Bytes from the host; `done` once they are parsed, the stream's credit. */
  write(chunk: Uint8Array | string, done: () => void): void {
    this.term.write(chunk, done);
  }

  resize(cols: number, rows: number): void {
    if (cols === this.term.cols && rows === this.term.rows) return;
    this.term.resize(cols, rows);
    this.publish();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  snapshot = (): TerminalSnapshot => {
    if (!this.stale) return this.snap;
    this.stale = false;
    this.snap = this.read();
    return this.snap;
  };

  dispose(): void {
    if (this.pending) clearTimeout(this.pending);
    this.listeners.clear();
    this.term.dispose();
  }

  private publish(): void {
    this.stale = true;
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      for (const listener of this.listeners) listener();
    }, PUBLISH_EVERY_MS);
  }

  private read(): TerminalSnapshot {
    const buffer = this.term.buffer.active;
    // Trailing blank lines below the cursor are the screen's unused rows.
    const last = Math.max(buffer.baseY + buffer.cursorY, this.lastInk());
    const lines: TerminalLine[] = [];
    for (let y = 0; y <= last; y++) {
      const line = buffer.getLine(y);
      if (!line) continue;
      const runs: TerminalRun[] = [];
      for (let x = 0; x < line.length; x++) {
        const cell = line.getCell(x, this.cell);
        if (!cell || cell.getWidth() === 0) continue;
        const inverse = cell.isInverse() !== 0;
        const fg = colourOf(cell, 'fg');
        const bg = colourOf(cell, 'bg');
        const style = {
          fg: inverse ? (bg ?? 'inverse-fg') : fg,
          bg: inverse ? (fg ?? 'inverse-bg') : bg,
          bold: cell.isBold() !== 0,
          dim: cell.isDim() !== 0,
          italic: cell.isItalic() !== 0,
          underline: cell.isUnderline() !== 0,
        };
        const char = cell.getChars() || ' ';
        const previous = runs[runs.length - 1];
        if (previous && sameStyle(previous, style)) previous.text += char;
        else runs.push({ text: char, ...style });
      }
      // Trailing spaces in the default style carry nothing to draw.
      const tail = runs[runs.length - 1];
      if (tail && tail.bg === null) {
        tail.text = tail.text.replace(/ +$/, '');
        if (tail.text === '') runs.pop();
      }
      lines.push({ index: y, runs });
    }
    const cursorLine = buffer.baseY + buffer.cursorY;
    return { lines, cursorLine: cursorLine <= last ? cursorLine : null };
  }

  private lastInk(): number {
    const buffer = this.term.buffer.active;
    for (let y = buffer.length - 1; y >= 0; y--) {
      if (buffer.getLine(y)?.translateToString(true).trim()) return y;
    }
    return 0;
  }
}
