import {
  DragProvider,
  SortableItem,
  TaskBoard,
  TaskCard,
  TaskColumn,
  TaskColumnAdd,
  TaskSessionChip,
} from '@oppenheimer/design-system-web';
import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import {
  useCreateTask,
  useMoveTask,
  useSuspenseTaskBoard,
} from '@oppenheimer/frontend-consumer/react';
import {
  ErrorAlert,
  formatCalendarDay,
  notifySuccess,
  useDragLabels,
  useLocale,
} from '@oppenheimer/frontend-web';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnComposer } from '../components/column-composer';
import { useBoardDrag } from '../hooks/use-board-drag';
import { useBoardFilter } from '../hooks/use-board-filter';
import { useToday } from '../hooks/use-today';
import { COLUMNS, columnOf, filingOf } from '../lib/board';
import { cardView, dueDayLabel } from '../lib/card-view';
import { sessionLineOf } from '../lib/session-line';
import { SESSION_STATUS } from '../lib/session-state';

const board = getRouteApi('/_authenticated/plan/');

/**
 * The four columns (`18-plan-product.md` §2) on the design system's board:
 * cards in board order, dragged within and across columns on the drag
 * layer, ticked to Done and back, added at a column's foot. A drop moves the
 * card at once and the server's answer settles it; a refused move puts it
 * back and says why above the columns. It reads under Suspense, in the
 * screen's `QueryState`; a refetch that fails keeps the columns and says so
 * above them.
 */
export function BoardColumns() {
  const { t } = useTranslation();
  const locale = useLocale();
  const dragLabels = useDragLabels();
  const today = useToday();
  const filter = useBoardFilter();
  const navigate = board.useNavigate();
  const go = useNavigate();
  const read = useSuspenseTaskBoard();
  const projectNames = new Map(
    read.projects.map((row) => [row.id, row.isUnassigned ? null : row.name]),
  );
  const unassignedId = read.projects.find((row) => row.isUnassigned)?.id;
  const milestones = new Map(read.milestones.map((row) => [row.id, row]));
  const sessions = new Map(read.sessions.map((row) => [row.id, row]));
  const hosts = new Map(read.hosts.map((row) => [row.id, row]));
  const move = useMoveTask();
  const create = useCreateTask({ onSuccess: () => notifySuccess('taskAdded') });
  const [composing, setComposing] = useState<TaskStatus | null>(null);
  const rows = read.tasks;
  const byId = new Map(rows.map((row) => [row.id, row]));
  const drag = useBoardDrag(
    Object.fromEntries(
      COLUMNS.map((status) => [status, columnOf(rows, status, filter).map((row) => row.id)]),
    ),
    (next) => move.mutate(next),
  );

  const words = {
    today: t('tasks.dates.today'),
    tomorrow: t('tasks.dates.tomorrow'),
    yesterday: t('tasks.dates.yesterday'),
  };
  const context = {
    filter,
    today,
    projectName: (id: string) => projectNames.get(id) ?? null,
    milestoneName: (id: string) => milestones.get(id)?.name ?? null,
    dayLabel: (iso: string) =>
      dueDayLabel(iso, today, words, (day) => formatCalendarDay(day, locale, 'short')),
  };
  const milestone = filter.milestoneId ? milestones.get(filter.milestoneId) : undefined;
  const filed = milestone?.name ?? (filter.projectId ? projectNames.get(filter.projectId) : null);

  const card = (task: TaskEntity, lifted = false) => {
    const view = cardView(task, context);
    const line = sessionLineOf(task, sessions, hosts);
    return (
      <TaskCard
        title={view.title}
        notes={view.notes || undefined}
        done={view.done}
        checkLabel={t(view.done ? 'tasks.card.markNotDone' : 'tasks.card.markDone')}
        onToggleDone={() =>
          move.mutate({ id: task.id, status: task.isDone ? 'todo' : 'done', afterTaskId: null })
        }
        project={view.projectName ?? undefined}
        milestone={view.milestoneName ?? undefined}
        due={view.due ?? undefined}
        dueTone={view.dueTone}
        startLabel={t('tasks.card.start')}
        onStart={
          lifted || task.sessions.length > 0
            ? undefined
            : () => navigate({ search: (previous) => ({ ...previous, start: task.id }) })
        }
        onClick={(event) => {
          // The card's own controls (the check, Start, the session) are theirs.
          if ((event.target as HTMLElement).closest('button, a, input, [role="checkbox"]')) return;
          navigate({ search: (previous) => ({ ...previous, task: task.id }) });
        }}
        session={
          line ? (
            <TaskSessionChip
              state={SESSION_STATUS[line.state]}
              word={t(`tasks.sessionState.${line.state}`)}
              name={line.name}
              more={line.others}
              aria-label={t('tasks.card.openSession', { name: line.name })}
              onClick={(event) => {
                event.stopPropagation();
                go({ to: '/sessions/$sessionId', params: { sessionId: line.sessionId } });
              }}
            />
          ) : undefined
        }
      />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <ErrorAlert error={read.error} fallback={t('tasks.board.loadFailed')} />
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
      <DragProvider
        live
        {...drag.handlers}
        labels={dragLabels}
        overlay={(active) => {
          const task = byId.get(active.id);
          return task ? card(task, true) : null;
        }}
      >
        <TaskBoard data-bleed>
          {COLUMNS.map((status) => {
            const ids = drag.groups[status] ?? [];
            const label = t(`tasks.columns.${status}`);
            return (
              <TaskColumn
                key={status}
                id={status}
                status={status}
                label={label}
                count={ids.length}
                items={ids}
                onAdd={() => setComposing(status)}
                addLabel={t('tasks.board.addTo', { column: label })}
                foot={
                  composing === status ? (
                    <ColumnComposer
                      label={t('tasks.board.quickPlaceholder')}
                      placeholder={t('tasks.board.quickPlaceholder')}
                      hint={
                        filed
                          ? t('tasks.board.filedUnder', { name: filed })
                          : t('tasks.board.filedAll')
                      }
                      keys={{ add: t('tasks.board.keyAdd'), cancel: t('tasks.board.keyCancel') }}
                      onCancel={() => setComposing(null)}
                      onSubmit={(title) =>
                        create.mutate({
                          title,
                          status,
                          ...filingOf(filter, read.milestones, unassignedId),
                        })
                      }
                    />
                  ) : (
                    <TaskColumnAdd onClick={() => setComposing(status)}>
                      {t('tasks.board.addTask')}
                    </TaskColumnAdd>
                  )
                }
              >
                {ids.map((id) => {
                  const task = byId.get(id);
                  return task ? (
                    <SortableItem key={id} id={id} data={{ type: 'task', label: task.title }}>
                      {card(task)}
                    </SortableItem>
                  ) : null;
                })}
              </TaskColumn>
            );
          })}
        </TaskBoard>
      </DragProvider>
    </div>
  );
}
