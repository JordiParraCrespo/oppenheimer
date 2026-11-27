import type { SessionStream } from '@oppenheimer/frontend-consumer';
import { ATTACHMENT_HISTORY_MAX_LINES } from '@oppenheimer/shared/protocol';
import { Terminal } from '@xterm/xterm';
import { readTerminalTheme, TERMINAL_FONT, terminalMinimumContrastRatio } from './terminal-theme';

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
 * `onChange` hears the page open (with a way to close it) and close (null).
 */
export function bindWatcherHistory(
  term: Terminal,
  container: HTMLElement,
  stream: SessionStream,
  onChange: (close: (() => void) | null) => void,
): { wheel(lines: number): void; dispose(): void } {
  let phase: Phase = 'live';
  // Notches up that arrived while the page was on its way.
  let pending = 0;
  let overlay: { box: HTMLElement; view: Terminal; themes: MutationObserver } | null = null;
  let waiting: ReturnType<typeof setTimeout> | null = null;
  const stopWaiting = () => {
    if (waiting !== null) clearTimeout(waiting);
    waiting = null;
  };

  const close = () => {
    stopWaiting();
    if (phase === 'live') return;
    phase = 'live';
    pending = 0;
    if (overlay) {
      overlay.themes.disconnect();
      overlay.view.dispose();
      overlay.box.remove();
      overlay = null;
      onChange(null);
    }
    term.focus();
  };

  const open = (text: string) => {
    const box = document.createElement('div');
    box.dataset.slot = 'terminal-history';
    box.style.position = 'absolute';
    box.style.inset = '0';
    box.style.zIndex = '1';
    const theme = readTerminalTheme();
    box.style.background = theme.background ?? 'transparent';
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.append(box);

    const view = new Terminal({
      ...TERMINAL_FONT,
      theme,
      minimumContrastRatio: terminalMinimumContrastRatio(),
      cols: term.cols,
      rows: term.rows,
      scrollback: ATTACHMENT_HISTORY_MAX_LINES + term.rows,
      // capture-pane ends each line with a bare newline.
      convertEol: true,
      disableStdin: true,
      cursorBlink: false,
      cursorInactiveStyle: 'none',
    });
    view.open(box);
    // Light or dark switched while the page is open: it follows, as the grid does.
    const themes = new MutationObserver(() => {
      const next = readTerminalTheme();
      view.options.theme = next;
      view.options.minimumContrastRatio = terminalMinimumContrastRatio();
      box.style.background = next.background ?? 'transparent';
    });
    themes.observe(document.documentElement, { attributeFilter: ['class'] });
    overlay = { box, view, themes };

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
      onChange(close);
    });
  };

  const offHistory =
    stream.onHistory?.((page) => {
      if (phase !== 'asking') return;
      stopWaiting();
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
      phase = 'asking';
      pending = lines;
      stream.askHistory(ATTACHMENT_HISTORY_MAX_LINES);
      waiting = setTimeout(close, PAGE_WAIT_MS);
    },
    dispose() {
      stopWaiting();
      offHistory();
      offResize.dispose();
      if (overlay) {
        overlay.themes.disconnect();
        overlay.view.dispose();
        overlay.box.remove();
        overlay = null;
      }
    },
  };
}
