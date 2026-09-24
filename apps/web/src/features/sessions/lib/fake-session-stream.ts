/**
 * A `SessionStream` that replays a recorded transcript: what fed the terminal
 * before the relay existed, kept for offline development and for the render
 * tests, which must not need a socket. The real transport is
 * `session-stream.ts`; nothing above either knows which it holds.
 */

import type { SessionStream, StreamStatus } from './session-stream';

const noop = () => {};

const ESC = '[';
const RESET = `${ESC}0m`;
const DIM = `${ESC}90m`;
const BOLD = `${ESC}1m`;
const BLUE = `${ESC}34m`;
const GREEN = `${ESC}32m`;
const YELLOW = `${ESC}33m`;
const RED = `${ESC}31m`;
const CYAN = `${ESC}36m`;

/**
 * A recorded session, replayed. Every escape sequence here is one a real
 * agent emits, so the colours exercise the ANSI mapping in `terminal-theme.ts`
 * rather than a private vocabulary that would pass while the real thing fails.
 */
const TRANSCRIPT: ReadonlyArray<{ after: number; text: string }> = [
  { after: 0, text: `${DIM}[tmux] attached to session sess_7fc2 — window 0${RESET}\r\n` },
  {
    after: 120,
    text: `${DIM}worktree /Users/jordi/code/oppenheimer-feat-terminal${RESET}\r\n\r\n`,
  },
  { after: 240, text: `${BLUE}$ ${RESET}claude\r\n` },
  { after: 520, text: `${DIM}Claude Code — oppenheimer — feat/terminal-surface${RESET}\r\n\r\n` },
  {
    after: 760,
    text: `${BOLD}●${RESET} I've mounted xterm.js on the session route. The theme bridge reads the\r\n  ${CYAN}--term-*${RESET} ramp off the document and re-applies it whenever the app\r\n  switches theme, so the grid follows instead of freezing at mount.\r\n\r\n`,
  },
  { after: 1400, text: `${BLUE}$ ${RESET}pnpm check:structure\r\n` },
  {
    after: 1750,
    text: `${GREEN}✓${RESET} frontend layout contract — 151 files, 0 violations\r\n\r\n`,
  },
  { after: 2000, text: `${BLUE}$ ${RESET}pnpm arch\r\n` },
  { after: 2380, text: `${GREEN}✓${RESET} apps/web — no boundary violations\r\n\r\n` },
  { after: 2600, text: `${BLUE}$ ${RESET}pnpm check:bundle\r\n` },
  {
    after: 3000,
    text: `${YELLOW}⚠${RESET}  session route chunk +214 KB (xterm + webgl addon)\r\n${GREEN}✓${RESET} critical path 371 KB / 385 KB — route chunks excluded\r\n\r\n`,
  },
  { after: 3400, text: `${BLUE}$ ${RESET}pnpm test --filter @oppenheimer/web\r\n` },
  { after: 3900, text: `${RED}✗${RESET} use-terminal.spec.ts — expected 24 rows, received 0\r\n` },
  {
    after: 3960,
    text: `${DIM}   the container has no height until the shell lays it out${RESET}\r\n\r\n`,
  },
  {
    after: 4400,
    text: `${BOLD}●${RESET} That's the fit addon measuring a collapsed box. The pane needs a\r\n  definite height before the first fit, not after it. Fixing.\r\n\r\n`,
  },
  { after: 5200, text: `${BLUE}$ ${RESET}` },
];

/**
 * Replays `TRANSCRIPT`, then behaves like a shell: echoes what you type,
 * handles Backspace, and answers Enter with a fresh prompt.
 *
 * The echo is the point. `product/versions/mvp/06-step-one-spike.md` judges the
 * real thing by keystroke echo latency — a key is not drawn because the browser
 * drew it, it is drawn because the host sent it back. Building against a fake
 * that echoes locally keeps that loop honest.
 */
export class FakeSessionStream implements SessionStream {
  private readonly dataListeners = new Set<(chunk: string, consumed: () => void) => void>();
  private readonly statusListeners = new Set<(status: StreamStatus) => void>();
  private readonly timers: ReturnType<typeof setTimeout>[] = [];
  private status: StreamStatus = 'connecting';
  private disposed = false;
  private line = '';

  constructor() {
    this.timers.push(
      setTimeout(() => {
        if (!this.disposed) this.setStatus('live');
      }, 80),
    );
    for (const step of TRANSCRIPT) {
      this.timers.push(
        setTimeout(() => {
          if (!this.disposed) this.emit(step.text);
        }, step.after),
      );
    }
  }

  onData(listener: (chunk: string, consumed: () => void) => void): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onEnd(): () => void {
    // The replay never ends on its own; only dispose ends it.
    return noop;
  }

  onStatus(listener: (status: StreamStatus) => void): () => void {
    listener(this.status);
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  send(data: string): void {
    if (this.disposed) return;
    if (data === '\r') {
      this.line = '';
      this.emit(`\r\n${BLUE}$ ${RESET}`);
      return;
    }
    if (data === '\x7f') {
      if (this.line.length === 0) return;
      this.line = this.line.slice(0, -1);
      this.emit('\b \b');
      return;
    }
    // Control characters other than the two handled above are swallowed:
    // the real PTY decides what Ctrl-C does, and guessing here would teach
    // the screen a behaviour the host does not have.
    if (data < ' ') return;
    this.line += data;
    this.emit(data);
  }

  resize(): void {
    // The real stream sends a resize control message here. A replay has no
    // reflow to do, and pretending otherwise would hide that the message is
    // still unwritten.
  }

  dispose(): void {
    this.disposed = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.dataListeners.clear();
    this.setStatus('closed');
    this.statusListeners.clear();
  }

  private emit(chunk: string): void {
    for (const listener of this.dataListeners) listener(chunk, noop);
  }

  private setStatus(next: StreamStatus): void {
    this.status = next;
    for (const listener of this.statusListeners) listener(next);
  }
}
