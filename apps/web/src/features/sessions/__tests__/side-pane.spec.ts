import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSidePane } from '../hooks/use-side-pane';
import {
  closeTab,
  openKept,
  rememberSidePane,
  shownTab,
  storedSidePane,
  windowAgent,
} from '../lib/side-pane';

/**
 * What a session's side pane keeps on this device, and which tab shows.
 * The regressions these hold: a stored pane that another build wrote (an item
 * kind this one does not know, a broken value) opening on a crash or on a tab
 * that cannot draw; opening a bot twice giving it two tabs; closing the tab
 * that shows leaving the pane on nothing rather than on its neighbour; and a
 * terminal closed on another device leaving its tab chosen with nothing in it.
 */

const SESSION = 'session-1';

afterEach(() => window.localStorage.clear());

describe('storedSidePane', () => {
  it('opens on the launcher with nothing stored, or with storage that does not parse', () => {
    expect(storedSidePane(SESSION)).toEqual({ items: [], active: null });
    window.localStorage.setItem(`oppenheimer.session.side.${SESSION}`, '{not json');
    expect(storedSidePane(SESSION)).toEqual({ items: [], active: null });
  });

  it('keeps what it can draw and drops what it cannot', () => {
    window.localStorage.setItem(
      `oppenheimer.session.side.${SESSION}`,
      JSON.stringify({
        items: [
          { kind: 'bot', botId: 'b1' },
          { kind: 'terminal', window: 2 },
          { kind: 'preview', tab: 'radio' },
          { kind: 'session' },
          { kind: 'preview', tab: 'browser' },
        ],
        active: 'bot:b1',
      }),
    );
    expect(storedSidePane(SESSION)).toEqual({
      items: [
        { kind: 'bot', botId: 'b1' },
        { kind: 'preview', tab: 'browser' },
      ],
      active: 'bot:b1',
    });
  });

  it('is kept per session', () => {
    rememberSidePane(SESSION, { items: [{ kind: 'bot', botId: 'b1' }], active: 'bot:b1' });
    expect(storedSidePane('session-2').items).toEqual([]);
    expect(storedSidePane(SESSION).active).toBe('bot:b1');
  });
});

describe('openKept', () => {
  it('shows an item that is open already rather than opening it again', () => {
    const once = openKept({ items: [], active: null }, { kind: 'bot', botId: 'b1' });
    const twice = openKept({ ...once, active: null }, { kind: 'bot', botId: 'b1' });
    expect(twice).toEqual({ items: [{ kind: 'bot', botId: 'b1' }], active: 'bot:b1' });
  });
});

describe('closeTab', () => {
  const order = ['terminal:1', 'bot:b1', 'session:s2'];

  it('shows the next tab when the shown one closes, else the one before', () => {
    expect(closeTab(order, 'bot:b1', 'bot:b1')).toBe('session:s2');
    expect(closeTab(order, 'session:s2', 'session:s2')).toBe('bot:b1');
  });

  it('leaves the shown tab alone when another closes, and the launcher when none is left', () => {
    expect(closeTab(order, 'terminal:1', 'bot:b1')).toBe('terminal:1');
    expect(closeTab(['bot:b1'], 'bot:b1', 'bot:b1')).toBeNull();
  });
});

describe('shownTab', () => {
  it('shows the first tab when the chosen one is gone, and the launcher when chosen', () => {
    expect(shownTab(['terminal:2', 'bot:b1'], 'terminal:1')).toBe('terminal:2');
    expect(shownTab(['terminal:2'], null)).toBeNull();
    expect(shownTab([], 'terminal:1')).toBeNull();
  });
});

describe('useSidePane', () => {
  it('keeps a bot opened while a terminal was opening when the terminal is shown', () => {
    const { result } = renderHook(() => useSidePane(SESSION));
    // The terminal's open answers over a round trip, from a handler made
    // before the bot was picked.
    const showTerminal = result.current.show;
    act(() => result.current.open({ kind: 'bot', botId: 'b1' }));
    act(() => showTerminal('terminal:1'));

    expect(result.current.kept).toEqual({
      items: [{ kind: 'bot', botId: 'b1' }],
      active: 'terminal:1',
    });
    expect(storedSidePane(SESSION).items).toEqual([{ kind: 'bot', botId: 'b1' }]);
  });
});

describe('windowAgent', () => {
  // The tab says which agent runs in a window. The regression: a shell tab
  // titled as an agent, or a second Codex titled "Terminal 2".
  it('is the agent a window is named after, and none for a shell or an unknown name', () => {
    expect(windowAgent('codex')).toBe('codex');
    expect(windowAgent('claude-code')).toBe('claude-code');
    expect(windowAgent('shell')).toBeNull();
    expect(windowAgent('bash')).toBeNull();
  });
});
