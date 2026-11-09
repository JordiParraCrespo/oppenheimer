import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTodoOrder } from '../hooks/use-todo-order';
import { storedTodoOrder } from '../lib/todo-order';

/**
 * Ticking a task on To do leaves it where it was. The tick moves it to the
 * top of Done on the board, so the day's own order (by rank) would put it
 * somewhere else. What breaks this: a tick that lets the ticked row jump, or
 * one that freezes the rest so a task added since no longer sorts in place.
 */
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('useTodoOrder', () => {
  it('keeps a ticked task under the row it sat under, and lets the rest sort', () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useTodoOrder('2026-11-09', '2026-11-09', ids),
      { initialProps: { ids: ['a', 'b', 'c'] } },
    );
    act(() => result.current.hold('b'));
    rerender({ ids: ['b', 'a', 'c'] });
    expect(result.current.order).toEqual(['a', 'b', 'c']);

    rerender({ ids: ['early', 'b', 'a', 'c'] });
    expect(result.current.order).toEqual(['early', 'a', 'b', 'c']);
    expect(storedTodoOrder('2026-11-09')).toEqual([]);
  });
});
