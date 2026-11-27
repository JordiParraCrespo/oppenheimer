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

type Page = { text: string; truncated: boolean };

function watcherStream(answers = true) {
  let deliver: ((page: Page) => void) | null = null;
  const asked: number[] = [];
  const stream = {
    onHistory: (listener: (page: Page) => void) => {
      deliver = listener;
      return () => {
        deliver = null;
      };
    },
    askHistory: answers ? (lines: number) => asked.push(lines) : undefined,
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
    const close = onChange.mock.lastCall?.[0] as (() => void) | null;
    expect(close).toBeTypeOf('function');

    close?.();
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
    expect(onChange).not.toHaveBeenCalledWith(expect.any(Function));
    history.dispose();
    term.dispose();
  });

  it('asks nothing of a stream that cannot ask, and ignores notches down', () => {
    const { term, container } = liveGrid();
    const silent = watcherStream(false);
    const answering = watcherStream();
    bindWatcherHistory(term, container, silent.stream, vi.fn()).wheel(-3);
    const history = bindWatcherHistory(term, container, answering.stream, vi.fn());
    history.wheel(3);
    expect(answering.asked).toEqual([]);
    history.dispose();
    term.dispose();
  });
});
