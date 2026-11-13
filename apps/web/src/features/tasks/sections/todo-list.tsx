import {
  DragProvider,
  dragIgnore,
  EmptyState,
  IconButton,
  SortableGroup,
  SortableTodoRow,
  StatusDot,
  TaskSessionChip,
  TodoRow,
} from '@oppenheimer/design-system-web';
import { Play } from '@oppenheimer/design-system-web/icons';
import {
  useMoveTask,
  useSuspenseTaskBoard,
  useUpdateTask,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, useDragLabels, useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { TodoMove } from '../components/todo-move';
import { useScopeProject } from '../hooks/use-scope-project';
import { useTodoDay } from '../hooks/use-todo-day';
import { TODO_GROUP, useTodoOrder } from '../hooks/use-todo-order';
import { taskSessionsOf } from '../lib/session-line';
import { SESSION_STATUS } from '../lib/session-state';
import { heldByDeadline, type TodoEntry, todoDay, todoLabels, todoPlaceOf } from '../lib/todo';
import { todoStatusOf } from '../lib/todo-status';

const todo = getRouteApi('/_authenticated/plan/todo');

/**
 * The day's tasks (the 2026-11-08 `Tasks` frame), each a `TodoRow`: its
 * milestone, since when it has been carried and when it is due under the
 * title, its status (the board's dot and column), the time it is due at
 * when that is the day shown, its project. Ticking one moves it to Done (or back to To do) as the board's
 * tick does, in its place on the list; its title opens it here, in the task dialog; its play button opens Start
 * session for it on this screen (`?start=`), on any task not done; its grip
 * drags it into the reader's own order for the day, kept on this device
 * (`useTodoOrder`). Its Move button puts it on another TODO day, Tomorrow
 * or one picked on a month, unless its deadline holds it on the day shown
 * (`heldByDeadline`), where moving its TODO day would change nothing on screen.
 *
 * A task an agent is working on (a session running or queued, none waiting
 * on the person) leaves the list for the "With agents" strip under it, its
 * session's state in place of its column; one whose agents need the person,
 * failed or stopped, or that sits In review, stays on the list with a mark
 * saying so (`todoPlaceOf`). The strip keeps the list's order and is not
 * dragged. It reads under Suspense, in the screen's `QueryState`; a refetch
 * that fails keeps the list and says so above it.
 */
export function TodoList() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { day, today } = useTodoDay();
  const { overdue } = todo.useSearch();
  const { projectIds } = useScopeProject();
  const navigate = todo.useNavigate();
  const go = useNavigate();
  const read = useSuspenseTaskBoard();
  const move = useMoveTask();
  const update = useUpdateTask();
  const projects = new Map(read.projects.map((row) => [row.id, row]));
  const milestones = new Map(read.milestones.map((row) => [row.id, row.name]));
  const sessions = new Map(read.sessions.map((row) => [row.id, row]));
  const hosts = new Map(read.hosts.map((row) => [row.id, row]));
  const dragLabels = useDragLabels();
  const options = { today, overdue: overdue !== 'off', projectIds };
  const { entries, dayHasAny } = todoDay(read.tasks, day, options);
  const places = new Map(
    entries.map((entry) => [
      entry.task.id,
      todoPlaceOf(entry.task, taskSessionsOf(entry.task, sessions, hosts)),
    ]),
  );
  const listed = entries.filter((entry) => places.get(entry.task.id)?.lane !== 'agents');
  const withAgents = entries.filter((entry) => places.get(entry.task.id)?.lane === 'agents');
  const byId = new Map(entries.map((entry) => [entry.task.id, entry]));
  const { order, handlers, hold } = useTodoOrder(
    day,
    today,
    listed.map((entry) => entry.task.id),
  );

  // Where the task stands (`todoStatusOf`): the session its place names, as a
  // chip that opens it, or a dot.
  const statusOf = (entry: TodoEntry) => {
    const place = places.get(entry.task.id) ?? todoPlaceOf(entry.task, []);
    const status = todoStatusOf(entry.task, place);
    if (status.kind === 'session') {
      const { session } = status.session;
      return (
        <TaskSessionChip
          state={SESSION_STATUS[status.session.state]}
          word={t(status.label)}
          name={session.name}
          aria-label={t('tasks.card.openSession', { name: session.name })}
          className="w-auto max-w-56 shrink"
          onClick={() => go({ to: '/sessions/$sessionId', params: { sessionId: session.id } })}
        />
      );
    }
    return (
      <StatusDot state={status.state} density="compact" className="shrink-0 text-sm text-fg-muted">
        {t(status.label)}
      </StatusDot>
    );
  };

  const toggle = (entry: TodoEntry) => {
    const { task } = entry;
    hold(task.id);
    move.mutate({ id: task.id, status: task.isDone ? 'todo' : 'done', afterTaskId: null });
  };

  const actionOf = (entry: TodoEntry) => {
    const { task } = entry;
    if (task.isDone) return undefined;
    return (
      <>
        {heldByDeadline(task, day, options) ? null : (
          <TodoMove
            title={task.title}
            today={today}
            onMove={(next) => update.mutate({ id: task.id, input: { focusDate: next } })}
          />
        )}
        <IconButton
          {...dragIgnore}
          type="button"
          size="sm"
          aria-label={t('tasks.todo.startSession', { title: task.title })}
          title={t('tasks.dialog.startSession')}
          onClick={() => navigate({ search: (previous) => ({ ...previous, start: task.id }) })}
        >
          <Play />
        </IconButton>
      </>
    );
  };

  // What a row does, the same in the list and in the strip.
  const handlersOf = (entry: TodoEntry) => ({
    onToggle: () => toggle(entry),
    onOpen: () => navigate({ search: (previous) => ({ ...previous, task: entry.task.id }) }),
    action: actionOf(entry),
  });

  const rowOf = (entry: TodoEntry) => {
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
      status: statusOf(entry),
      toggleLabel: t(task.isDone ? 'tasks.card.markNotDone' : 'tasks.card.markDone'),
    };
  };

  return (
    <>
      <ErrorAlert error={read.error} fallback={t('tasks.todo.loadFailed')} />
      <ErrorAlert error={move.error} fallback={t('tasks.todo.toggleFailed')} />
      <ErrorAlert
        error={update.error}
        fallback={t('tasks.todo.moveFailed')}
        onDismiss={update.reset}
      />
      {listed.length === 0 && withAgents.length === 0 ? (
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
                  {...handlersOf(entry)}
                />
              );
            })}
          </SortableGroup>
        </DragProvider>
      )}
      {withAgents.length > 0 ? (
        <section aria-labelledby="todo-with-agents" className="mt-5 flex flex-col gap-2">
          <h2 id="todo-with-agents" className="eyebrow">
            {t('tasks.todo.withAgents')}
          </h2>
          {withAgents.map((entry) => (
            <TodoRow key={entry.task.id} {...rowOf(entry)} {...handlersOf(entry)} />
          ))}
        </section>
      ) : null}
    </>
  );
}
