import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSessionPins } from '../hooks/use-session-pins';
import { SESSION_PINS_KEY, splitPinned, storedSessionPins, withPin } from '../lib/session-pins';

/**
 * A pinned session comes back pinned on the next visit, on top of the ones
 * pinned before it, and is drawn once: under Pinned, never in its project
 * too. Anything unreadable in storage is no pin.
 */

const session = (id: string) => ({ id }) as SessionEntity;
const idsOf = (rows: { id: string }[]) => rows.map((row) => row.id);

afterEach(() => window.localStorage.clear());

describe('useSessionPins', () => {
  it('keeps a pin across a reload, the latest on top, and forgets an unpin', () => {
    const first = renderHook(() => useSessionPins());
    act(() => first.result.current.setPinned('s1', true));
    act(() => first.result.current.setPinned('s2', true));
    first.unmount();

    const second = renderHook(() => useSessionPins());
    expect(second.result.current.pins).toEqual(['s2', 's1']);
    act(() => second.result.current.setPinned('s2', false));
    expect(storedSessionPins()).toEqual(['s1']);
  });
});

describe('storedSessionPins', () => {
  it.each(['{not json', '"s1"', '[1,"s1","s1"]'])('reads %s as what it can make of it', (raw) => {
    window.localStorage.setItem(SESSION_PINS_KEY, raw);
    expect(storedSessionPins()).toEqual(raw.includes('s1') && raw.startsWith('[') ? ['s1'] : []);
  });
});

describe('withPin', () => {
  it('moves a session pinned again to the top rather than listing it twice', () => {
    expect(withPin(['a', 'b'], 'b', true)).toEqual(['b', 'a']);
  });
});

describe('splitPinned', () => {
  it('draws the pinned in pin order and the rest as they came, skipping a pin with no row', () => {
    const { pinned, rest } = splitPinned(
      [session('a'), session('b'), session('c'), session('d')],
      ['c', 'gone', 'a'],
    );
    expect(idsOf(pinned)).toEqual(['c', 'a']);
    expect(idsOf(rest)).toEqual(['b', 'd']);
  });
});
