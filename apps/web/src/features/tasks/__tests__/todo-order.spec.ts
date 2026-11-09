import { afterEach, describe, expect, it } from 'vitest';
import {
  inStoredOrder,
  rememberTodoOrder,
  storedTodoOrder,
  TODO_ORDER_KEY,
} from '../lib/todo-order';

/**
 * The order a reader drags a day's To do into comes back on the next visit,
 * for that day only; a task the stored order does not name keeps its place
 * after the ones it does, and anything unreadable is the list's own order.
 */
afterEach(() => window.localStorage.clear());

describe('To do order', () => {
  it('puts the stored ids first, as stored, then the rest as they came', () => {
    expect(inStoredOrder(['a', 'b', 'c', 'd'], ['c', 'gone', 'a'])).toEqual(['c', 'a', 'b', 'd']);
  });

  it('keeps each day its own order, and drops days long past on a write', () => {
    window.localStorage.setItem(TODO_ORDER_KEY, JSON.stringify({ '2026-08-01': ['x'] }));
    rememberTodoOrder('2026-11-09', ['b', 'a'], '2026-11-09');
    rememberTodoOrder('2026-11-10', ['c'], '2026-11-09');
    expect(storedTodoOrder('2026-11-09')).toEqual(['b', 'a']);
    expect(storedTodoOrder('2026-11-10')).toEqual(['c']);
    expect(storedTodoOrder('2026-08-01')).toEqual([]);
  });

  it.each(['{not json', '[]', '"a"'])('falls back to the list order on %s', (raw) => {
    window.localStorage.setItem(TODO_ORDER_KEY, raw);
    expect(storedTodoOrder('2026-11-09')).toEqual([]);
  });
});
