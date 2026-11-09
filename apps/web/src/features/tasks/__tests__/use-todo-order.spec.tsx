import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTodoOrder } from '../hooks/use-todo-order';
import { storedTodoOrder } from '../lib/todo-order';

/**
 * Ticking a task on To do leaves it where it was. The tick moves it to the
 * top of Done on the board, so the day's own order (by rank) puts it
 * somewhere else; what breaks this is a tick that lets the list re-sort.
 */
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('useTodoOrder', () => {
  it('keeps the list as drawn when a tick re-sorts the day, here and on the next visit', () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useTodoOrder('2026-11-09', '2026-11-09', ids),
      { initialProps: { ids: ['a', 'b', 'c'] } },
    );
    act(() => result.current.hold());
    rerender({ ids: ['c', 'a', 'b'] });
    expect(result.current.order).toEqual(['a', 'b', 'c']);
    expect(storedTodoOrder('2026-11-09')).toEqual(['a', 'b', 'c']);
  });
});
