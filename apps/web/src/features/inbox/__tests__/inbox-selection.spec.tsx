import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useInboxSelection } from '../hooks/use-inbox-selection';

/**
 * The rows picked for a bulk action in the Inbox: a shift-click takes the run
 * from the last row picked, select all toggles every row shown, a row that
 * leaves the list leaves the selection (so a bulk action never reaches an
 * item no longer on screen), and Escape clears it.
 */

function setup(initial: string[]) {
  return renderHook(({ shown }) => useInboxSelection(shown), {
    initialProps: { shown: initial },
  });
}

describe('selecting Inbox rows for a bulk action', () => {
  it('takes the run since the last row picked on a shift-click', () => {
    const { result } = setup(['a', 'b', 'c', 'd', 'e']);
    act(() => result.current.toggle('b', true));
    act(() => result.current.toggle('d', true, true));
    expect(result.current.keys).toEqual(['b', 'c', 'd']);

    act(() => result.current.toggle('c', false, true));
    expect(result.current.keys).toEqual(['b']);
  });

  it('selects every row shown, then none', () => {
    const { result } = setup(['a', 'b', 'c']);
    act(() => result.current.toggle('a', true));
    act(() => result.current.toggleAll());
    expect(result.current.all).toBe(true);
    act(() => result.current.toggleAll());
    expect(result.current.any).toBe(false);
  });

  it('drops a row that leaves the list', () => {
    const { result, rerender } = setup(['a', 'b', 'c']);
    act(() => result.current.toggleAll());
    rerender({ shown: ['a', 'c'] });
    expect(result.current.keys).toEqual(['a', 'c']);
    expect(result.current.all).toBe(true);
  });

  it('clears on Escape', () => {
    const { result } = setup(['a', 'b']);
    act(() => result.current.toggle('a', true));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.any).toBe(false);
  });
});
