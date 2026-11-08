import { EmptyState, TodoRow } from '@oppenheimer/design-system-web';
import { useMoveTask, useSuspensePlan } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { useTodoDay } from '../hooks/use-todo-day';
import { todoDay, todoStateLabel } from '../lib/todo';

const todo = getRouteApi('/_authenticated/plan/todo');

/**
 * The day's tasks (the 2026-11-08 `Tasks` frame), each a `TodoRow`: its
 * milestone and where it stands under the title, the time it is due at, its
 * project. Ticking one moves it to Done (or back to To do) as the board's
 * tick does; its title opens it on the board. It reads under Suspense, in
 * the screen's `QueryState`; a refetch that fails keeps the list and says so
 * above it.
 */
export function TodoList() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { day, today } = useTodoDay();
  const { overdue } = todo.useSearch();
  const { projectIds } = useScopeProject();
  const go = useNavigate();
  const read = useSuspensePlan();
  const move = useMoveTask();
  const projects = new Map(read.projects.map((row) => [row.id, row]));
  const milestones = new Map(read.milestones.map((row) => [row.id, row.name]));
  const { entries, dayHasAny } = todoDay(read.tasks, day, {
    today,
    overdue: overdue !== 'off',
    projectIds,
  });

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
        entries.map((entry) => {
          const { task } = entry;
          const project = projects.get(task.projectId);
          const milestone = task.milestoneId ? milestones.get(task.milestoneId) : undefined;
          const label = todoStateLabel(entry, day, today);
          const where =
            'date' in label
              ? t(label.key, { date: formatCalendarDay(label.date, locale) })
              : t(label.key);
          return (
            <TodoRow
              key={task.id}
              title={task.title}
              detail={[milestone, where].filter(Boolean).join(' · ')}
              time={task.dueTime ?? undefined}
              tag={project && !project.isUnassigned ? project.name : undefined}
              done={task.isDone}
              toggleLabel={t(task.isDone ? 'tasks.card.markNotDone' : 'tasks.card.markDone')}
              onToggle={() =>
                move.mutate({
                  id: task.id,
                  status: task.isDone ? 'todo' : 'done',
                  afterTaskId: null,
                })
              }
              onOpen={() => go({ to: '/plan', search: { task: task.id } })}
            />
          );
        })
      )}
    </>
  );
}
