import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOpenTabs } from '../hooks/use-open-tabs';
import { openTabOf, tabAfterClosing } from '../lib/open-tabs';

/**
 * The tabs over Sessions are this device's, kept across a reload, in the
 * order they were opened. Arriving on a page opens its tab without moving
 * the others; closing the one on screen shows its neighbour, the way a
 * browser closes a tab; another browser tab's change is drawn here too.
 */

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('open tabs', () => {
  it('opens the page on screen at the end, keeps it across a reload, and never moves a tab already open', () => {
    const first = renderHook(({ shown }) => useOpenTabs(shown), {
      initialProps: { shown: 'session:a' },
    });
    first.rerender({ shown: 'bot:b' });
    first.rerender({ shown: 'session:a' });
    first.unmount();

    const reloaded = renderHook(() => useOpenTabs('session:a'));
    expect(reloaded.result.current.keys).toEqual(['session:a', 'bot:b']);
  });

  it('shows the neighbour after the tab that closed, the one before at the end, and nothing after the last', () => {
    const keys = ['session:a', 'session:b', 'session:c'];
    expect(tabAfterClosing(keys, 'session:b', 'session:b')).toBe('session:c');
    expect(tabAfterClosing(keys, 'session:c', 'session:c')).toBe('session:b');
    expect(tabAfterClosing(['session:a'], 'session:a', 'session:a')).toBeNull();
    // Closing a tab that is not on screen leaves the screen as it is.
    expect(tabAfterClosing(keys, 'session:a', 'session:c')).toBe('session:a');
  });

  it('keeps the page on screen among the tabs after it is closed, until the reader moves on', () => {
    const strip = renderHook(() => useOpenTabs('session:a'));
    act(() => strip.result.current.close('session:a'));
    expect(strip.result.current.keys).toEqual(['session:a']);
  });

  it('redraws when another browser tab opens one, so both strips agree', () => {
    const strip = renderHook(() => useOpenTabs('session:a'));
    act(() => {
      window.localStorage.setItem(
        'oppenheimer.sessions.tabs',
        JSON.stringify(['session:a', 'session:z']),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: 'oppenheimer.sessions.tabs' }));
    });
    expect(strip.result.current.keys).toEqual(['session:a', 'session:z']);
  });

  it('reads only what a tab can be: a session or a bot, with an id', () => {
    expect(openTabOf('session:a:b')).toEqual({ kind: 'session', id: 'a:b' });
    expect(openTabOf('bot:x')).toEqual({ kind: 'bot', id: 'x' });
    expect(openTabOf('task:x')).toBeNull();
    expect(openTabOf('session:')).toBeNull();
    expect(openTabOf('nonsense')).toBeNull();
  });

  // Last: the kit holds a refused list for the page, until a write lands.
  it('keeps the tabs on this page when storage refuses to save them', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const strip = renderHook(({ shown }) => useOpenTabs(shown), {
      initialProps: { shown: 'session:a' },
    });
    strip.rerender({ shown: 'session:b' });
    expect(strip.result.current.keys).toEqual(['session:a', 'session:b']);

    act(() => strip.result.current.close('session:a'));
    expect(strip.result.current.keys).toEqual(['session:b']);
  });
});
