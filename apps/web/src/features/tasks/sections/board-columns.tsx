import { toast } from '@oppenheimer/design-system-web';
import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import {
  useCreateTask,
  useGoals,
  useHosts,
  useMoveTask,
  useProjects,
  useSessions,
  useTasks,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, useLocale } from '@oppenheimer/frontend-web';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { type DragEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoardColumn } from '../components/board-column';
import { BoardSkeleton } from '../components/board-skeleton';
import { DropPlaceholder } from '../components/drop-placeholder';
import { TaskCard } from '../components/task-card';
import { TaskSessionLine } from '../components/task-session-line';
import { QuickTaskForm } from '../forms/quick-task-form';
import { useBoardFilter } from '../hooks/use-board-filter';
import { useToday } from '../hooks/use-today';
import { afterTaskIdFor, COLUMNS, columnOf } from '../lib/board';
import { cardView, dueDayLabel } from '../lib/card-view';
import { sessionLineOf } from '../lib/session-line';

const board = getRouteApi('/_authenticated/plan/');

/** Where a dragged card would land: a column, and its index among the other cards. */
interface DropTarget {
  status: TaskStatus;
  index: number;
}

/**
 * The four columns (`18-plan-product.md` §2): cards in board order, dragged
 * within and across columns, ticked to Done and back, added inline at a
 * column's foot. A drop moves the card at once and the server's answer
 * settles it; a refused move puts it back and says why above the columns.
 */
export function BoardColumns() {
  const { t } = useTranslation();
  const locale = useLocale();
  const today = useToday();
  const filter = useBoardFilter();
  const navigate = board.useNavigate();
  const go = useNavigate();
  const tasks = useTasks();
  const { data: projectNames } = useProjects({
    select: (rows) => new Map(rows.map((row) => [row.id, row.isUnassigned ? null : row.name])),
  });
  const { data: unassignedId } = useProjects({
    select: (rows) => rows.find((row) => row.isUnassigned)?.id,
  });
  const { data: goals } = useGoals({ select: (rows) => new Map(rows.map((row) => [row.id, row])) });
  const { data: sessions } = useSessions({
    select: (rows) => new Map(rows.map((row) => [row.id, row])),
  });
  const { data: hosts } = useHosts({ select: (rows) => new Map(rows.map((row) => [row.id, row])) });
  const move = useMoveTask();
  const create = useCreateTask({ onSuccess: () => toast.success(t('toasts.taskAdded')) });
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<DropTarget | null>(null);
  const [composing, setComposing] = useState<TaskStatus | null>(null);

  if (tasks.isPending) return <BoardSkeleton />;
  if (tasks.isError)
    return <ErrorAlert error={tasks.error} fallback={t('tasks.board.loadFailed')} />;

  const rows = tasks.data;
  const words = {
    today: t('tasks.dates.today'),
    tomorrow: t('tasks.dates.tomorrow'),
    yesterday: t('tasks.dates.yesterday'),
  };
  const context = {
    filter,
    today,
    projectName: (id: string) => projectNames?.get(id) ?? null,
    goalName: (id: string) => goals?.get(id)?.name ?? null,
    dayLabel: (iso: string) =>
      dueDayLabel(iso, today, words, (day) => formatCalendarDay(day, locale, 'short')),
  };
  const goal = filter.goalId ? goals?.get(filter.goalId) : undefined;
  const filed = goal?.name ?? (filter.projectId ? projectNames?.get(filter.projectId) : null);

  const toggle = (task: TaskEntity) =>
    move.mutate({ id: task.id, status: task.isDone ? 'todo' : 'done', afterTaskId: null });

  const dropIndex = (event: DragEvent<HTMLDivElement>) => {
    const cards = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-card]')].filter(
      (card) => card.dataset.card !== dragging,
    );
    return cards.filter((card) => {
      const box = card.getBoundingClientRect();
      return box.top + box.height / 2 < event.clientY;
    }).length;
  };

  const drop = (status: TaskStatus, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const task = rows.find((row) => row.id === dragging);
    const index = dropIndex(event);
    setDragging(null);
    setOver(null);
    if (!task) return;
    // The cards the reader sees, so the drop lands under the one it was dropped under.
    const shown = columnOf(rows, status, filter);
    const afterTaskId = afterTaskIdFor(
      shown.filter((row) => row.id !== task.id),
      index,
    );
    const at = shown.findIndex((row) => row.id === task.id);
    const unchanged = at !== -1 && (shown[at - 1]?.id ?? null) === afterTaskId;
    if (!unchanged) move.mutate({ id: task.id, status, afterTaskId });
  };

  return (
    <div className="flex flex-col gap-3">
      <ErrorAlert
        error={move.error}
        fallback={t('tasks.board.moveFailed')}
        onDismiss={move.reset}
      />
      <ErrorAlert
        error={create.error}
        fallback={t('tasks.board.addFailed')}
        onDismiss={create.reset}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((status) => {
          const cards = columnOf(rows, status, filter);
          const placeholderAt = over?.status === status ? over.index : -1;
          // The dragged card stays mounted (unmounting the source ends the drag
          // in Chromium), dimmed; the placeholder counts only the others.
          const others = cards.filter((card) => card.id !== dragging);
          return (
            <BoardColumn
              key={status}
              status={status}
              name={t(`tasks.columns.${status}`)}
              count={cards.length}
              addLabel={t('tasks.board.addTo', { column: t(`tasks.columns.${status}`) })}
              over={over?.status === status}
              onAdd={() => setComposing(status)}
              onDragOver={(event) => {
                if (!dragging) return;
                event.preventDefault();
                const index = dropIndex(event);
                if (over?.status !== status || over.index !== index) setOver({ status, index });
              }}
              onDrop={(event) => drop(status, event)}
              footer={
                composing === status ? (
                  <QuickTaskForm
                    hint={filed ? t('tasks.board.filedUnder', { name: filed }) : null}
                    onClose={() => setComposing(null)}
                    onSubmit={(title) =>
                      create.mutate({
                        title,
                        status,
                        projectId: filter.projectId || unassignedId,
                        goalId: filter.goalId ?? null,
                      })
                    }
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setComposing(status)}
                    className="rounded-md px-2.5 py-2 text-left text-sm text-fg-subtle transition-colors duration-fast hover:bg-active-surface hover:text-fg-muted"
                  >
                    {t('tasks.board.addTask')}
                  </button>
                )
              }
            >
              {cards.flatMap((task) => {
                const index = others.indexOf(task);
                const line = sessionLineOf(task, sessions ?? new Map(), hosts ?? new Map());
                const card = (
                  <TaskCard
                    key={task.id}
                    task={cardView(task, context)}
                    dragging={task.id === dragging}
                    labels={{
                      done: t('tasks.card.markDone'),
                      notDone: t('tasks.card.markNotDone'),
                      start: t('tasks.card.start'),
                    }}
                    session={
                      line ? (
                        <TaskSessionLine
                          state={line.state}
                          word={t(`tasks.sessionState.${line.state}`)}
                          name={line.name}
                          more={line.others ? `+${line.others}` : null}
                          label={t('tasks.card.openSession', { name: line.name })}
                          onOpen={() =>
                            go({
                              to: '/sessions/$sessionId',
                              params: { sessionId: line.sessionId },
                            })
                          }
                        />
                      ) : null
                    }
                    onOpen={() =>
                      navigate({ search: (previous) => ({ ...previous, task: task.id }) })
                    }
                    onToggle={() => toggle(task)}
                    onStart={
                      task.sessions.length === 0 && !task.isDone
                        ? () =>
                            navigate({ search: (previous) => ({ ...previous, start: task.id }) })
                        : undefined
                    }
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', task.id);
                      // After the drag has begun: Chromium cancels a drag whose
                      // source re-renders inside its own dragstart.
                      requestAnimationFrame(() => setDragging(task.id));
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                  />
                );
                return index === placeholderAt ? [<DropPlaceholder key="drop" />, card] : [card];
              })}
              {placeholderAt >= others.length ? <DropPlaceholder /> : null}
            </BoardColumn>
          );
        })}
      </div>
    </div>
  );
}
