import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { TodoListSkeleton } from '../components/todo-list-skeleton';
import { PlanFilters } from '../sections/plan-filters';
import { TodoAdd } from '../sections/todo-add';
import { TodoHeader } from '../sections/todo-header';
import { TodoList } from '../sections/todo-list';
import { TodoOverdueToggle } from '../sections/todo-overdue-toggle';

/**
 * Plan's To do (the 2026-11-08 `Tasks` frame): the day's header, the Project
 * filter with Include overdue at the end of its row, the day's tasks, each a
 * card, and the row that adds one to the day.
 */
export function TodoScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-7">
      <TodoHeader />
      <div className="-mt-3 flex flex-wrap items-center gap-2">
        <PlanFilters view="todo" />
        <span className="flex-1" />
        <TodoOverdueToggle />
      </div>
      <div className="flex flex-col gap-2">
        <QueryState>
          <QueryState.Pending>
            <TodoListSkeleton />
          </QueryState.Pending>
          <QueryState.Error fallback={t('tasks.todo.loadFailed')} />
          <QueryState.Data>
            <TodoList />
          </QueryState.Data>
        </QueryState>
        <TodoAdd />
      </div>
    </div>
  );
}
