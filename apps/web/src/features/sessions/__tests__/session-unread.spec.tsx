import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useClearUnreadOnOpen, useSessionUnread } from '../hooks/use-session-unread';

/**
 * A session marked unread keeps its dot across a reload until it is opened,
 * from wherever it is opened: the pane takes the mark off, and the row,
 * mounted or not, reads the same list. Marking the open session does not
 * clear it at once, or the mark would never stick on the session on screen.
 */

afterEach(() => window.localStorage.clear());

describe('session unread marks', () => {
  it('keeps a mark across a reload and takes it off when the session is opened', () => {
    const first = renderHook(() => useSessionUnread('s1'));
    act(() => first.result.current.setUnread(true));
    first.unmount();

    const row = renderHook(() => useSessionUnread('s1'));
    expect(row.result.current.unread).toBe(true);

    renderHook(() => useClearUnreadOnOpen('s1'));
    expect(row.result.current.unread).toBe(false);
  });

  it('keeps the mark on the open session it was set on, until the reader comes back to it', () => {
    const pane = renderHook(({ id }) => useClearUnreadOnOpen(id), { initialProps: { id: 's1' } });
    const row = renderHook(() => useSessionUnread('s1'));

    act(() => row.result.current.setUnread(true));
    pane.rerender({ id: 's1' });
    expect(row.result.current.unread).toBe(true);

    pane.rerender({ id: 's2' });
    pane.rerender({ id: 's1' });
    expect(row.result.current.unread).toBe(false);
  });
});
