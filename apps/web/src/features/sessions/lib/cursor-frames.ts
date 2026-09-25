/**
 * How long a frame opened by a hidden cursor may stay open before it is
 * painted anyway: the gap between a TUI's hide and show is a few
 * milliseconds, and a program that hides its cursor for good is held back by
 * this much once.
 */
export const CURSOR_FRAME_MAX_MS = 100;

const ESC = 0x1b;
const HIDE = '\x1b[?25l';
// tmux shows the cursor with terminfo's `cnorm` (`ESC[?12l ESC[?25h`), or
// `cvvis` (`ESC[?12;25h`) when the pane asked for a blinking one.
const SHOWS = ['\x1b[?25h', '\x1b[?12;25h'];
const SYNC_ON = '\x1b[?2026h';
const SYNC_OFF = '\x1b[?2026l';

export interface CursorFrameTimers {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const browserTimers: CursorFrameTimers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Turns a program's "hide the cursor … show it" into one frame for xterm.
 *
 * A TUI redraws by hiding the cursor, writing the frame and showing the cursor
 * again, each step its own flush — ratatui does, and so Codex does, on every
 * tick of its "Working" timer. A local terminal takes the three together.
 * Here they cross tmux, the relay and a WebSocket, and when the hide lands in
 * one animation frame and the show in the next, xterm paints a frame with no
 * cursor: many times a second, for as long as the agent works. The program's
 * own synchronized-output markers (DEC 2026) would have said "these belong
 * together", but tmux consumes them and does not pass them on.
 *
 * So the console puts them back: synchronized output opens in front of a hide
 * and closes behind the show, in place in the byte stream, and xterm paints
 * what lies between as one frame. A hide with no show behind it — Claude Code
 * hides the terminal's cursor and draws its own — is painted after `maxMs`.
 *
 * `frame` rewrites one chunk on its way to `term.write`; `close` is how the
 * frame ends when no show comes, and is handed to the constructor.
 */
export class CursorFrames {
  private open = false;
  private timer: unknown = null;

  constructor(
    private readonly close: (data: string) => void,
    private readonly maxMs: number = CURSOR_FRAME_MAX_MS,
    private readonly timers: CursorFrameTimers = browserTimers,
  ) {}

  frame<T extends Uint8Array | string>(chunk: T): T {
    const out = typeof chunk === 'string' ? this.rewriteText(chunk) : this.rewriteBytes(chunk);
    if (this.open && this.timer === null) {
      this.timer = this.timers.set(() => {
        this.timer = null;
        if (!this.open) return;
        this.open = false;
        this.close(SYNC_OFF);
      }, this.maxMs);
    } else if (!this.open) {
      this.cancel();
    }
    return out as T;
  }

  dispose(): void {
    this.cancel();
  }

  private cancel() {
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
  }

  /** What to write for the sequence at the start of `rest`, if it is one. */
  private replace(startsWith: (sequence: string) => boolean): [number, string] | null {
    if (startsWith(HIDE)) {
      if (this.open) return [HIDE.length, HIDE];
      this.open = true;
      return [HIDE.length, SYNC_ON + HIDE];
    }
    for (const show of SHOWS) {
      if (!startsWith(show)) continue;
      if (!this.open) return [show.length, show];
      this.open = false;
      return [show.length, show + SYNC_OFF];
    }
    return null;
  }

  private rewriteText(chunk: string): string {
    if (!chunk.includes('\x1b[?')) return chunk;
    let out = '';
    let from = 0;
    for (let i = chunk.indexOf('\x1b', 0); i !== -1; i = chunk.indexOf('\x1b', i + 1)) {
      const hit = this.replace((sequence) => chunk.startsWith(sequence, i));
      if (!hit) continue;
      out += chunk.slice(from, i) + hit[1];
      from = i + hit[0];
      i = from - 1;
    }
    return from === 0 ? chunk : out + chunk.slice(from);
  }

  private rewriteBytes(chunk: Uint8Array): Uint8Array {
    const parts: (Uint8Array | string)[] = [];
    let from = 0;
    let length = 0;
    for (let i = chunk.indexOf(ESC); i !== -1; i = chunk.indexOf(ESC, i + 1)) {
      const hit = this.replace((sequence) => bytesStartWith(chunk, i, sequence));
      if (!hit) continue;
      parts.push(chunk.subarray(from, i), hit[1]);
      length += i - from + hit[1].length;
      from = i + hit[0];
      i = from - 1;
    }
    if (from === 0) return chunk;
    parts.push(chunk.subarray(from));
    length += chunk.length - from;
    const out = new Uint8Array(length);
    let at = 0;
    for (const part of parts) {
      if (typeof part === 'string') {
        // Escape sequences are ASCII, one byte a character.
        for (let k = 0; k < part.length; k++) out[at++] = part.charCodeAt(k);
      } else {
        out.set(part, at);
        at += part.length;
      }
    }
    return out;
  }
}

function bytesStartWith(bytes: Uint8Array, at: number, sequence: string): boolean {
  if (at + sequence.length > bytes.length) return false;
  for (let k = 0; k < sequence.length; k++) {
    if (bytes[at + k] !== sequence.charCodeAt(k)) return false;
  }
  return true;
}
