/**
 * Whether a task is off To do after an edit. The request's own `offTodo` wins
 * (Remove sends it with the TODO day cleared). Otherwise a new TODO day, or a
 * due date on another day, puts it back on To do; a new due time on the same
 * day, or any other edit, leaves it as it was.
 */
export function offTodoAfterEdit(edit: {
  current: boolean;
  offTodo: boolean | undefined;
  focusDate: string | null | undefined;
  dueDateBefore: string | null;
  dueDateAfter: string | null;
}): boolean {
  if (edit.offTodo !== undefined) return edit.offTodo;
  const planned = edit.focusDate !== undefined && edit.focusDate !== null;
  if (planned || edit.dueDateBefore !== edit.dueDateAfter) return false;
  return edit.current;
}
