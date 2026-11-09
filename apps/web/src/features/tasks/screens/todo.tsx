import { QueryState } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { TodoListSkeleton } from '../components/todo-list-skeleton';
import { StartSessionDialog } from '../dialogs/start-session';
import { TaskDialog } from '../dialogs/task';
import { PlanFilters } from '../sections/plan-filters';
import { TodoAdd } from '../sections/todo-add';
import { TodoHeader } from '../sections/todo-header';
import { TodoList } from '../sections/todo-list';
import { TodoOverdueToggle } from '../sections/todo-overdue-toggle';
import { TodoSchedule } from '../sections/todo-schedule';

const todo = getRouteApi('/_authenticated/plan/todo');

/**
 * Plan's To do (the 2026-11-08 `Tasks` frame): the day's header, the Project
 * filter with Add undated tasks and Include overdue at the end of its row,
 * the day's tasks, each a card, and the row that adds one to the day. A row
 * opens its task here (`?task=<task>`), so saving it leaves you on the day,
 * and its play button opens Start session here (`?start=<task>`), as the
 * board's task dialog does.
 */
export function TodoScreen() {
  const { t } = useTranslation();
  const { task, start } = todo.useSearch();
  const navigate = todo.useNavigate();
  return (
    <div className="flex flex-col gap-7">
      <TodoHeader />
      <div className="-mt-3 flex flex-wrap items-center gap-2">
        <PlanFilters view="todo" />
        <span className="flex-1" />
        <TodoSchedule />
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
      <TaskDialog
        open={task}
        onClose={() => navigate({ search: (previous) => ({ ...previous, task: undefined }) })}
        onStartSession={(id) =>
          navigate({ search: (previous) => ({ ...previous, task: undefined, start: id }) })
        }
      />
      <StartSessionDialog
        taskId={start}
        onClose={() => navigate({ search: (previous) => ({ ...previous, start: undefined }) })}
      />
    </div>
  );
}
