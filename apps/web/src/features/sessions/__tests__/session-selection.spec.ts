import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSessionSelectionStore } from '../hooks/use-session-selection';
import { clickPick, NO_SELECTION, pickSession } from '../lib/session-selection';

/**
 * Picking rows the way a file list does: ⌘/Ctrl toggles one, Shift spans from
 * the last one toggled over the rows as drawn, and once something is picked a
 * plain click picks instead of opening the session. Escape leaves selection.
 */

const ORDER = ['a', 'b', 'c', 'd', 'e'];

describe('pickSession', () => {
  it('toggles one row in and out, and the last toggle is the anchor', () => {
    const one = pickSession(NO_SELECTION, 'b', 'toggle', ORDER);
    const two = pickSession(one, 'd', 'toggle', ORDER);
    expect(two).toEqual({ ids: ['b', 'd'], anchor: 'd' });
    expect(pickSession(two, 'd', 'toggle', ORDER)).toEqual({ ids: ['b'], anchor: 'd' });
    expect(pickSession(pickSession(one, 'b', 'toggle', ORDER), 'b', 'toggle', ORDER).ids).toEqual([
      'b',
    ]);
  });

  it('empties to no selection, so the list leaves selection', () => {
    const one = pickSession(NO_SELECTION, 'b', 'toggle', ORDER);
    expect(pickSession(one, 'b', 'toggle', ORDER)).toBe(NO_SELECTION);
  });

  it('spans from the anchor either way, adding to what is picked and keeping the anchor', () => {
    const anchored = pickSession(
      pickSession(NO_SELECTION, 'a', 'toggle', ORDER),
      'd',
      'toggle',
      ORDER,
    );
    const down = pickSession(anchored, 'b', 'range', ORDER);
    expect(down).toEqual({ ids: ['a', 'd', 'b', 'c'], anchor: 'd' });
    expect(pickSession(down, 'e', 'range', ORDER).ids).toEqual(['a', 'd', 'b', 'c', 'e']);
  });

  it('toggles when there is no anchor, or the anchor is no longer drawn', () => {
    expect(pickSession(NO_SELECTION, 'c', 'range', ORDER)).toEqual({ ids: ['c'], anchor: 'c' });
    const hidden = { ids: ['z'], anchor: 'z' };
    expect(pickSession(hidden, 'c', 'range', ORDER)).toEqual({ ids: ['z', 'c'], anchor: 'c' });
  });
});

describe('clickPick', () => {
  const plain = { shiftKey: false, metaKey: false, ctrlKey: false };

  it('opens the session on a plain click until something is picked', () => {
    expect(clickPick(plain, false)).toBeNull();
    expect(clickPick(plain, true)).toBe('toggle');
  });

  it('picks on ⌘, Ctrl and Shift', () => {
    expect(clickPick({ ...plain, metaKey: true }, false)).toBe('toggle');
    expect(clickPick({ ...plain, ctrlKey: true }, false)).toBe('toggle');
    expect(clickPick({ ...plain, shiftKey: true }, false)).toBe('range');
  });
});

describe('useSessionSelectionStore', () => {
  it('spans the order the sidebar last drew, and Escape clears', () => {
    const { result, rerender } = renderHook(({ order }) => useSessionSelectionStore(order), {
      initialProps: { order: ['a', 'b', 'c'] },
    });
    rerender({ order: ['c', 'b', 'a'] });
    const store = result.current;
    act(() => store.pick('c', 'toggle'));
    act(() => store.pick('b', 'range'));
    expect(store.ids()).toEqual(['c', 'b']);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(store.ids()).toEqual([]);
  });
});
