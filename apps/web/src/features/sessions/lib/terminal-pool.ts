import type { SessionStream } from '@oppenheimer/frontend-consumer';
import { CONSUMER_CONFIG } from '@oppenheimer/frontend-consumer/config';
import { type MountedSessionTerminal, mountSessionTerminal } from './terminal-runtime';

/**
 * The session terminals the console keeps, so moving between sessions does
 * not mean a new socket, a new attachment and a blank pane each time
 * (`product/01-terminal-first.md` §3, "the pane showing its last frame,
 * never blank").
 *
 * Two layers, Orca's answer adapted to a tab:
 *
 * - **Warm.** A terminal the reader leaves is parked rather than closed: its
 *   element leaves the page, its stream stays attached and its grid keeps
 *   following the session. Coming back puts the same element in the new pane;
 *   nothing dials. The most recent `warmTerminals` are kept, each for
 *   `warmForMs` after it was left.
 * - **Last frame.** A terminal that is closed leaves its screen and recent
 *   scrollback behind (`lastFrames` of them), and the next terminal for that
 *   window draws it while its stream dials (`restore`).
 *
 * A stream that ended (a stopped session, a refusal) is never kept or handed
 * out again, and leaves no frame: what comes next is a different terminal.
 * Signing out closes everything (`clearTerminalsOnSignOut`): a session's
 * output must not outlive the account that could read it, and a warm
 * terminal is handed out without asking the API again.
 */

/** Who is showing a terminal right now, and what it wants to hear. */
export interface TerminalHolder {
  onFirstOutput: () => void;
  onFiles?: (files: File[]) => void;
}

export interface TerminalClaim {
  stream: SessionStream;
  /** Hand the terminal back: parked if its stream is still good, closed if not. */
  release: () => void;
}

interface Entry {
  key: string;
  stream: SessionStream;
  /** The element xterm is opened in; moved between panes, never re-opened. */
  host: HTMLDivElement;
  terminal: MountedSessionTerminal;
  holder: TerminalHolder | null;
  ended: boolean;
  /** When it was parked, for the oldest-first trim; null while shown. */
  parkedAt: number | null;
  expiry: ReturnType<typeof setTimeout> | null;
  offEnd: () => void;
}

const entries = new Map<string, Entry>();
/** Last frames by window, oldest first (a `Map` keeps insertion order). */
const lastFrames = new Map<string, string>();

/**
 * The terminal for `key` (a session and window), shown in `container`. A warm
 * one is moved in as it is; otherwise a new one is opened on `createStream`,
 * drawing the window's last frame until the stream has something to say.
 */
export function claimTerminal(
  key: string,
  container: HTMLElement,
  createStream: () => SessionStream,
  holder: TerminalHolder,
  options: { agentWindow: boolean },
): TerminalClaim {
  const warm = entries.get(key);
  if (warm?.ended) close(warm, { keepFrame: false });
  const entry = warm && !warm.ended ? warm : open(key, container, createStream, options);

  if (entry.expiry !== null) clearTimeout(entry.expiry);
  entry.expiry = null;
  entry.parkedAt = null;
  entry.holder = holder;
  if (entry.host.parentElement !== container) {
    container.replaceChildren(entry.host);
    entry.terminal.shown();
  }
  if (entry.terminal.hasOutput) holder.onFirstOutput();

  return {
    stream: entry.stream,
    release: () => {
      // Claimed by another pane since, or closed under it (a sign-out).
      if (entry.holder !== holder || entries.get(entry.key) !== entry) return;
      entry.holder = null;
      if (entry.ended) {
        close(entry, { keepFrame: false });
        return;
      }
      park(entry);
    },
  };
}

/** Whether `key` has a terminal that can be shown without dialling. */
export function isTerminalWarm(key: string): boolean {
  const entry = entries.get(key);
  return entry !== undefined && !entry.ended;
}

/** Close every terminal and forget every frame. */
export function clearTerminals(): void {
  for (const entry of [...entries.values()]) close(entry, { keepFrame: false });
  lastFrames.clear();
}

/** The slice of the kernel's auth store this reads. */
interface AuthStoreLike {
  subscribe(listener: (state: { isAuthenticated: boolean }) => void): () => void;
}

let watchedAuth: AuthStoreLike | null = null;

/**
 * Close every terminal when the session ends (a sign-out, or the API no
 * longer honouring it). Watches one store for the app's lifetime, like the
 * pool it guards; a second call with the same store does nothing.
 */
export function clearTerminalsOnSignOut(store: AuthStoreLike): void {
  if (watchedAuth === store) return;
  watchedAuth = store;
  store.subscribe((state) => {
    if (!state.isAuthenticated) clearTerminals();
  });
}

/** Window 0 is the agent's (05); the pane shows only that one today. */
export const AGENT_WINDOW = 0;

/** The key a session window's terminal is kept under. */
export function terminalKey(sessionId: string, window: number): string {
  return `${sessionId}:${window}`;
}

function open(
  key: string,
  container: HTMLElement,
  createStream: () => SessionStream,
  options: { agentWindow: boolean },
): Entry {
  // xterm measures its cells when it opens, so the element is in the page first.
  const host = document.createElement('div');
  host.className = 'size-full';
  container.replaceChildren(host);

  const restore = lastFrames.get(key);
  lastFrames.delete(key);
  const stream = createStream();
  // The callbacks go to whoever holds the terminal when they fire, which is
  // not who opened it once it has been parked and claimed again.
  const terminal = mountSessionTerminal(host, stream, {
    agentWindow: options.agentWindow,
    onFiles: (files) => entry.holder?.onFiles?.(files),
    onFirstOutput: () => entry.holder?.onFirstOutput(),
    restore,
  });
  const offEnd = stream.onEnd(() => {
    entry.ended = true;
    // Shown, its holder says why and closes it on release; parked, nobody
    // is looking and it goes now.
    if (entry.holder === null) close(entry, { keepFrame: false });
  });
  const entry: Entry = {
    key,
    stream,
    host,
    terminal,
    holder: null,
    ended: false,
    parkedAt: null,
    expiry: null,
    offEnd,
  };
  entries.set(key, entry);
  return entry;
}

function park(entry: Entry) {
  entry.host.remove();
  entry.parkedAt = Date.now();
  entry.expiry = setTimeout(
    () => close(entry, { keepFrame: true }),
    CONSUMER_CONFIG.stream.warmForMs,
  );
  const parked = [...entries.values()]
    .filter((candidate) => candidate.parkedAt !== null)
    .sort((a, b) => (a.parkedAt ?? 0) - (b.parkedAt ?? 0));
  for (const oldest of parked.slice(0, parked.length - CONSUMER_CONFIG.stream.warmTerminals)) {
    close(oldest, { keepFrame: true });
  }
}

function close(entry: Entry, { keepFrame }: { keepFrame: boolean }) {
  if (entries.get(entry.key) !== entry) return;
  entries.delete(entry.key);
  if (entry.expiry !== null) clearTimeout(entry.expiry);
  if (keepFrame && entry.terminal.hasOutput) {
    lastFrames.delete(entry.key);
    lastFrames.set(entry.key, entry.terminal.serialize(CONSUMER_CONFIG.stream.lastFrameScrollback));
    for (const stale of [...lastFrames.keys()].slice(
      0,
      Math.max(0, lastFrames.size - CONSUMER_CONFIG.stream.lastFrames),
    )) {
      lastFrames.delete(stale);
    }
  } else {
    lastFrames.delete(entry.key);
  }
  entry.offEnd();
  entry.terminal.dispose();
  entry.stream.dispose();
  entry.host.remove();
}
