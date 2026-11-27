import type { SessionStream } from '@oppenheimer/frontend-consumer';
import { ATTACHMENT_HISTORY_MAX_LINES } from '@oppenheimer/shared/protocol';
import type { Terminal } from '@xterm/xterm';
import { createThemedTerminal, followAppliedTheme } from './themed-terminal';

/**
 * What the reader sees of a watcher's history: a page open (and how to
 * close it), a page that could not be had (and how to ask again or let it
 * go), or nothing but the live grid (null).
 */
export type WatcherHistoryState =
  | { kind: 'open'; close: () => void }
  | { kind: 'failed'; retry: () => void; dismiss: () => void }
  | null;

/** What a watcher's history is doing: following the pane, waiting on a page, or showing one. */
type Phase = 'live' | 'asking' | 'open';

/**
 * How long a page is waited for. A host or relay that predates the ask never
 * answers; past this the next notch asks again rather than queueing forever.
 */
const PAGE_WAIT_MS = 5_000;

/**
 * A watcher's scrollback, for a read-only share. tmux draws on its alternate
 * screen, which keeps no scrollback in the browser, and a member scrolls
 * through tmux's copy mode, which is the pane's: a guest's wheel there would
 * scroll the owner's view, and tmux ignores it from a read-only client
 * anyway. So the guest's first notch up asks the host for the pane's
 * scrollback (`SessionStream.askHistory`), and the page, with its colours,
 * is drawn in a second terminal over the live grid, scrolled up by the
 * notches that asked for it. Scrolling back to its end, Escape, or `close`
 * returns to the live grid, which never stopped following the pane.
 *
 * A host that could not read the page, or no answer in `PAGE_WAIT_MS`, is
 * said as a failure with a retry, never as an empty scrollback. `onChange`
 * hears each state (`WatcherHistoryState`).
 */
export function bindWatcherHistory(
  term: Terminal,
  container: HTMLElement,
  stream: SessionStream,
  onChange: (state: WatcherHistoryState) => void,
): { wheel(lines: number): void; dispose(): void } {
  let phase: Phase = 'live';
  // Notches up that arrived while the page was on its way.
  let pending = 0;
  let overlay: { box: HTMLElement; view: Terminal; unfollowTheme: () => void } | null = null;
  let waiting: ReturnType<typeof setTimeout> | null = null;
  const stopWaiting = () => {
    if (waiting !== null) clearTimeout(waiting);
    waiting = null;
  };

  /** Takes the page off the grid; reports whether there was one. */
  const removeOverlay = (): boolean => {
    if (!overlay) return false;
    overlay.unfollowTheme();
    overlay.view.dispose();
    overlay.box.remove();
    overlay = null;
    return true;
  };

  const close = () => {
    stopWaiting();
    if (phase === 'live') return;
    phase = 'live';
    pending = 0;
    if (removeOverlay()) onChange(null);
    term.focus();
  };

  const ask = (lines: number) => {
    if (!stream.askHistory) return;
    phase = 'asking';
    pending = lines;
    stream.askHistory(ATTACHMENT_HISTORY_MAX_LINES);
    waiting = setTimeout(fail, PAGE_WAIT_MS);
  };

  // No page: said, with a way to ask again, so it never reads as nothing to scroll.
  function fail() {
    close();
    onChange({
      kind: 'failed',
      retry: () => {
        onChange(null);
        if (phase === 'live') ask(-term.rows);
      },
      dismiss: () => onChange(null),
    });
  }

  const open = (text: string) => {
    const box = document.createElement('div');
    box.dataset.slot = 'terminal-history';
    box.style.position = 'absolute';
    box.style.inset = '0';
    box.style.zIndex = '1';
    // The terminal's ground, as a token, so it follows light and dark itself.
    box.style.background = 'var(--term-bg)';
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.append(box);

    // Made as the live grid is, so the page draws exactly as it did.
    const view = createThemedTerminal({
      cols: term.cols,
      rows: term.rows,
      scrollback: ATTACHMENT_HISTORY_MAX_LINES + term.rows,
      // capture-pane ends each line with a bare newline.
      convertEol: true,
      disableStdin: true,
      cursorInactiveStyle: 'none',
    });
    view.open(box);
    overlay = { box, view, unfollowTheme: followAppliedTheme(view) };

    // Down to the end of the page is back to live; anything else scrolls it.
    view.attachCustomWheelEventHandler((event) => {
      if (event.deltaY > 0) {
        requestAnimationFrame(() => {
          const buffer = view.buffer.active;
          if (overlay?.view === view && buffer.viewportY >= buffer.baseY) close();
        });
      }
      return true;
    });
    view.attachCustomKeyEventHandler((event) => {
      if (event.type === 'keydown' && event.key === 'Escape') {
        close();
        return false;
      }
      return true;
    });

    // The cursor is the live grid's, not the page's.
    view.write(`\u001b[?25l${text.replace(/\n+$/, '')}`, () => {
      if (overlay?.view !== view) return;
      if (view.buffer.active.baseY === 0) {
        // Nothing above the screen: nothing to scroll back through.
        close();
        return;
      }
      view.scrollToBottom();
      view.scrollLines(Math.min(pending, -1));
      pending = 0;
      view.focus();
      onChange({ kind: 'open', close });
    });
  };

  const offHistory =
    stream.onHistory?.((page) => {
      if (phase !== 'asking') return;
      stopWaiting();
      if (page.failed) {
        fail();
        return;
      }
      if (page.text === '') {
        close();
        return;
      }
      phase = 'open';
      open(page.text);
    }) ?? (() => {});
  // A page drawn at the old width would wrap wrongly; the next notch asks again.
  const offResize = term.onResize(() => close());

  return {
    wheel(lines) {
      if (lines >= 0 || !stream.askHistory) return;
      if (phase === 'asking') {
        pending += lines;
        return;
      }
      if (phase !== 'live') return;
      onChange(null);
      ask(lines);
    },
    dispose() {
      stopWaiting();
      offHistory();
      offResize.dispose();
      removeOverlay();
    },
  };
}
