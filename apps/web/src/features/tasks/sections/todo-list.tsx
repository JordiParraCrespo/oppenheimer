import {
  DragProvider,
  EmptyState,
  IconButton,
  SortableGroup,
  SortableTodoRow,
  StatusDot,
  TASK_STATUS_STATE,
  TodoRow,
} from '@oppenheimer/design-system-web';
import { Play } from '@oppenheimer/design-system-web/icons';
import { useMoveTask, useSuspensePlan } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, useDragLabels, useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { useTodoDay } from '../hooks/use-todo-day';
import { TODO_GROUP, useTodoOrder } from '../hooks/use-todo-order';
import { todoDay, todoLabels } from '../lib/todo';

const todo = getRouteApi('/_authenticated/plan/todo');

/**
 * The day's tasks (the 2026-11-08 `Tasks` frame), each a `TodoRow`: its
 * milestone, since when it has been carried and when it is due under the
 * title, its status (the board's dot and column), the time it is due at
 * when that is the day shown, its project. Ticking one moves it to Done (or back to To do) as the board's
 * tick does, in its place on the list; its title opens it here, in the task dialog; its play button opens Start
 * session for it on this screen (`?start=`), on any task not done; its grip
 * drags it into the reader's own order for the day, kept on this device
 * (`useTodoOrder`). It reads under Suspense, in the screen's `QueryState`; a
 * refetch that fails keeps the list and says so above it.
 */
export function TodoList() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { day, today } = useTodoDay();
  const { overdue } = todo.useSearch();
  const { projectIds } = useScopeProject();
  const navigate = todo.useNavigate();
  const read = useSuspensePlan();
  const move = useMoveTask();
  const projects = new Map(read.projects.map((row) => [row.id, row]));
  const milestones = new Map(read.milestones.map((row) => [row.id, row.name]));
  const dragLabels = useDragLabels();
  const { entries, dayHasAny } = todoDay(read.tasks, day, {
    today,
    overdue: overdue !== 'off',
    projectIds,
  });
  const byId = new Map(entries.map((entry) => [entry.task.id, entry]));
  const { order, handlers, hold } = useTodoOrder(
    day,
    today,
    entries.map((entry) => entry.task.id),
  );

  const rowOf = (entry: (typeof entries)[number]) => {
    const { task } = entry;
    const project = projects.get(task.projectId);
    const milestone = task.milestoneId ? milestones.get(task.milestoneId) : undefined;
    const when = todoLabels(entry, day, today).map((label) =>
      'date' in label
        ? t(label.key, { date: formatCalendarDay(label.date, locale) })
        : t(label.key),
    );
    return {
      title: task.title,
      detail: [milestone, ...when].filter(Boolean).join(' · '),
      time: (task.dueDate === day && task.dueTime) || undefined,
      tag: project && !project.isUnassigned ? project.name : undefined,
      done: task.isDone,
      status: (
        <StatusDot
          state={TASK_STATUS_STATE[task.status]}
          density="compact"
          className="shrink-0 text-sm text-fg-muted"
        >
          {t(`tasks.columns.${task.status}`)}
        </StatusDot>
      ),
      toggleLabel: t(task.isDone ? 'tasks.card.markNotDone' : 'tasks.card.markDone'),
    };
  };

  return (
    <>
      <ErrorAlert error={read.error} fallback={t('tasks.todo.loadFailed')} />
      <ErrorAlert error={move.error} fallback={t('tasks.todo.toggleFailed')} />
      {entries.length === 0 ? (
        <EmptyState className="rounded-lg bg-card">
          <EmptyState.Header>
            <EmptyState.Description>
              {dayHasAny ? t('tasks.todo.noMatch') : t('tasks.todo.empty')}
            </EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      ) : (
        <DragProvider
          {...handlers}
          labels={dragLabels}
          overlay={(active) => {
            const entry = byId.get(active.id);
            return entry ? <TodoRow {...rowOf(entry)} /> : null;
          }}
        >
          <SortableGroup
            id={TODO_GROUP}
            items={order}
            accepts={['todo-row']}
            className="flex flex-col gap-2"
          >
            {order.map((id) => {
              const entry = byId.get(id);
              if (!entry) return null;
              const { task } = entry;
              return (
                <SortableTodoRow
                  key={id}
                  id={id}
                  {...rowOf(entry)}
                  gripLabel={t('tasks.todo.reorder', { title: task.title })}
                  onToggle={() => {
                    hold(task.id);
                    move.mutate({
                      id: task.id,
                      status: task.isDone ? 'todo' : 'done',
                      afterTaskId: null,
                    });
                  }}
                  onOpen={() =>
                    navigate({ search: (previous) => ({ ...previous, task: task.id }) })
                  }
                  action={
                    task.isDone ? undefined : (
                      <IconButton
                        type="button"
                        size="sm"
                        aria-label={t('tasks.todo.startSession', { title: task.title })}
                        title={t('tasks.dialog.startSession')}
                        onClick={() =>
                          navigate({ search: (previous) => ({ ...previous, start: task.id }) })
                        }
                      >
                        <Play />
                      </IconButton>
                    )
                  }
                />
              );
            })}
          </SortableGroup>
        </DragProvider>
      )}
    </>
  );
}
