/**
 * When a task taken off To do comes back: the rule `TaskEntity.edit` applies,
 * as a decision table. The entity spec covers it through real edits.
 */
import { describe, expect, it } from 'vitest';
import { offTodoAfterEdit } from '../domain/task-off-todo.policy';

const off = {
  current: true,
  offTodo: undefined,
  focusDate: undefined,
  dueDateBefore: '2026-11-15',
  dueDateAfter: '2026-11-15',
};

describe('offTodoAfterEdit', () => {
  it('lets the request say it outright, over anything else it changes', () => {
    expect(offTodoAfterEdit({ ...off, current: false, offTodo: true, focusDate: null })).toBe(true);
    expect(offTodoAfterEdit({ ...off, offTodo: false })).toBe(false);
  });

  it('puts it back on a new TODO day or a due date on another day', () => {
    expect(offTodoAfterEdit({ ...off, focusDate: '2026-11-18' })).toBe(false);
    expect(offTodoAfterEdit({ ...off, dueDateAfter: '2026-11-20' })).toBe(false);
    expect(offTodoAfterEdit({ ...off, dueDateAfter: null })).toBe(false);
  });

  it('keeps it off for a cleared TODO day, the same due date, or an edit that names neither', () => {
    expect(offTodoAfterEdit({ ...off, focusDate: null })).toBe(true);
    expect(offTodoAfterEdit(off)).toBe(true);
    expect(offTodoAfterEdit({ ...off, current: false })).toBe(false);
  });
});
