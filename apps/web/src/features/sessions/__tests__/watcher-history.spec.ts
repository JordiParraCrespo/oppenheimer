import type { SessionStream } from '@oppenheimer/frontend-consumer';
import { Terminal } from '@xterm/xterm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindWatcherHistory } from '../lib/watcher-history';

/**
 * A watcher on a read-only share scrolls back through a page the host reads
 * for it, drawn over the live grid: its wheel never reaches tmux, and tmux's
 * copy mode would move the owner's view. The regressions are a watcher's
 * terminal that does not scroll at all, and a page that never lets go of
 * the live grid.
 */

type Page = { text: string; truncated: boolean; failed?: boolean };

/**
 * A watcher's stream. `host` is what its host can do: answer asks, or, an
 * older runner, not (its `askHistory` asks nothing); `none` is a stream with
 * no history at all.
 */
function watcherStream(host: 'answers' | 'older' | 'none' = 'answers') {
  let deliver: ((page: Page) => void) | null = null;
  const asked: number[] = [];
  const stream = {
    onHistory: (listener: (page: Page) => void) => {
      deliver = listener;
      return () => {
        deliver = null;
      };
    },
    askHistory:
      host === 'none'
        ? undefined
        : (lines: number) => {
            if (host === 'older') return false;
            asked.push(lines);
            return true;
          },
  } as unknown as SessionStream;
  return { stream, asked, answer: (page: Page) => deliver?.(page) };
}

const scrollback = Array.from({ length: 200 }, (_, i) => `\u001b[32mline ${i}\u001b[0m`).join('\n');
const settle = () => new Promise((done) => setTimeout(done, 50));

let mounted: HTMLElement[] = [];
// xterm reads the pixel ratio through matchMedia, which jsdom lacks.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const box of mounted) box.remove();
  mounted = [];
});

function liveGrid() {
  const container = document.createElement('div');
  document.body.append(container);
  mounted.push(container);
  const term = new Terminal({ cols: 40, rows: 10, allowProposedApi: true });
  term.open(container);
  return { term, container };
}

describe('bindWatcherHistory', () => {
  it('asks for the scrollback on a notch up and draws the page over the live grid', async () => {
    const { term, container } = liveGrid();
    const { stream, asked, answer } = watcherStream();
    const onChange = vi.fn();
    const history = bindWatcherHistory(term, container, stream, onChange);

    history.wheel(-3);
    history.wheel(-3);
    expect(asked).toEqual([5000]);

    answer({ text: `${scrollback}\n`, truncated: false });
    await settle();
    expect(container.querySelector('[data-slot="terminal-history"]')).not.toBeNull();
    const state = onChange.mock.lastCall?.[0];
    expect(state).toMatchObject({ kind: 'open' });

    state.close();
    expect(container.querySelector('[data-slot="terminal-history"]')).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith(null);
    history.dispose();
    term.dispose();
  });

  it('stays on the live grid when there is nothing above the screen', async () => {
    const { term, container } = liveGrid();
    const { stream, answer } = watcherStream();
    const onChange = vi.fn();
    const history = bindWatcherHistory(term, container, stream, onChange);

    history.wheel(-3);
    answer({ text: 'only the screen\n', truncated: false });
    await settle();
    expect(container.querySelector('[data-slot="terminal-history"]')).toBeNull();
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'open' }));
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'failed' }));
    history.dispose();
    term.dispose();
  });

  it('says a page the host could not read, and asks again on retry', async () => {
    // What breaks this: a failed read drawn as nothing to scroll back through.
    const { term, container } = liveGrid();
    const { stream, asked, answer } = watcherStream();
    const onChange = vi.fn();
    const history = bindWatcherHistory(term, container, stream, onChange);

    history.wheel(-3);
    answer({ text: '', truncated: false, failed: true });
    const state = onChange.mock.lastCall?.[0];
    expect(state).toMatchObject({ kind: 'failed' });
    expect(container.querySelector('[data-slot="terminal-history"]')).toBeNull();

    state.retry();
    expect(asked).toEqual([5000, 5000]);
    answer({ text: `${scrollback}\n`, truncated: false });
    await settle();
    expect(onChange.mock.lastCall?.[0]).toMatchObject({ kind: 'open' });
    history.dispose();
    term.dispose();
  });

  it('says a page that never came, rather than waiting on it', () => {
    vi.useFakeTimers();
    try {
      const { term, container } = liveGrid();
      const { stream } = watcherStream();
      const onChange = vi.fn();
      const history = bindWatcherHistory(term, container, stream, onChange);
      history.wheel(-3);
      vi.advanceTimersByTime(5_000);
      expect(onChange.mock.lastCall?.[0]).toMatchObject({ kind: 'failed' });
      history.dispose();
      term.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('says nothing failed when the host cannot answer at all', () => {
    // What breaks this: an older runner, which never answers, drawn after the
    // wait as "Couldn't load the terminal's history".
    vi.useFakeTimers();
    try {
      const { term, container } = liveGrid();
      const { stream } = watcherStream('older');
      const onChange = vi.fn();
      const history = bindWatcherHistory(term, container, stream, onChange);
      history.wheel(-3);
      vi.advanceTimersByTime(10_000);
      expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ kind: 'failed' }));
      expect(container.querySelector('[data-slot="terminal-history"]')).toBeNull();
      history.dispose();
      term.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('asks nothing of a stream that cannot ask, and ignores notches down', () => {
    const { term, container } = liveGrid();
    const silent = watcherStream('none');
    const answering = watcherStream();
    bindWatcherHistory(term, container, silent.stream, vi.fn()).wheel(-3);
    const history = bindWatcherHistory(term, container, answering.stream, vi.fn());
    history.wheel(3);
    expect(answering.asked).toEqual([]);
    history.dispose();
    term.dispose();
  });
});
