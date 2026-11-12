import {
  DragProvider,
  IconButton,
  SortableItem,
  TaskBoard,
  TaskCard,
  TaskColumn,
  TaskColumnAdd,
  TaskColumnMore,
  TaskMarquee,
  TaskSelectionBar,
  TaskSessionChip,
} from '@oppenheimer/design-system-web';
import { Trash2, X } from '@oppenheimer/design-system-web/icons';
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
import { TASK_STATUSES, type TaskStatus } from '@oppenheimer/shared/schemas/task';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnComposer } from '../components/column-composer';
import { MoveTasksMenu } from '../components/move-tasks-menu';
import { DeleteTasksDialog } from '../dialogs/delete-tasks';
import { useBoardDrag } from '../hooks/use-board-drag';
import { useBoardFilter } from '../hooks/use-board-filter';
import { useBoardMarquee } from '../hooks/use-board-marquee';
import { useBulkMove } from '../hooks/use-bulk-move';
import { useCardSelection } from '../hooks/use-card-selection';
import { useToday } from '../hooks/use-today';
import { boardColumnsOf, doneCutoffOf, filingOf } from '../lib/board';
import { cardClickPick, droppedMoves, movesToColumn, OWNS_PRESS } from '../lib/card-selection';
import { cardView, dueDayLabel } from '../lib/card-view';
import { sessionLineOf } from '../lib/session-line';
import { SESSION_STATUS } from '../lib/session-state';

const board = getRouteApi('/_authenticated/plan/');

/**
 * The four columns (`18-plan-product.md` §2) on the design system's board:
 * cards in board order, dragged within and across columns on the drag
 * layer, ticked to Done and back, added at a column's foot. A drop moves the
 * card at once and the server's answer settles it; a refused move puts it
 * back and says why above the columns. Done shows the past week's tasks and
 * folds the older ones under "Show older" (`?older=1` opens it), so the
 * column does not grow without end. It reads under Suspense, in the
 * screen's `QueryState`; a refetch that fails keeps the columns and says so
 * above them.
 *
 * Cards can be picked to act on together (`useCardSelection`): ⌘/Ctrl-click
 * toggles one, Shift-click takes the run from the last one toggled, and while
 * any are picked a plain click toggles too, and a drag from the board's empty
 * space draws a rectangle that picks every card it touches
 * (`useBoardMarquee`). Dragging a picked card brings the others along under
 * it. The picked cards' bar floats at the foot of the page, with Move to (a
 * column, at its foot), Delete (asked first) and the way out; Escape leaves
 * as well.
 */
export function BoardColumns() {
  const { t } = useTranslation();
  const locale = useLocale();
  const dragLabels = useDragLabels();
  const today = useToday();
  const filter = useBoardFilter();
  const navigate = board.useNavigate();
  const { older: showOlder } = board.useSearch();
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
  const bulk = useBulkMove(move);
  const create = useCreateTask({ onSuccess: () => notifySuccess('taskAdded') });
  const [composing, setComposing] = useState<TaskStatus | null>(null);
  const rows = read.tasks;
  const byId = new Map(rows.map((row) => [row.id, row]));
  const { columns, folded } = boardColumnsOf(rows, filter, {
    cutoff: doneCutoffOf(today),
    showOlder: Boolean(showOlder),
  });
  const order = TASK_STATUSES.flatMap((status) => columns[status].map((row) => row.id));
  const selection = useCardSelection(order);
  const drag = useBoardDrag(
    Object.fromEntries(
      TASK_STATUSES.map((status) => [status, columns[status].map((row) => row.id)]),
    ),
    (next) => bulk.run(droppedMoves(next, selection.picked)),
  );
  const [deleting, setDeleting] = useState<TaskEntity[] | null>(null);
  const marquee = useBoardMarquee({
    picked: selection.picked,
    onPick: selection.keep,
    onClear: selection.clear,
  });
  const toggleOlder = () =>
    navigate({ search: (previous) => ({ ...previous, older: showOlder ? undefined : true }) });

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
  const filing = filingOf(filter, read.milestones, unassignedId);
  const filed =
    milestone?.name ??
    (filter.projectIds?.length && filing.projectId ? projectNames.get(filing.projectId) : null);

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
        selected={!lifted && selection.isPicked(task.id)}
        data-task-id={lifted ? undefined : task.id}
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
          if ((event.target as HTMLElement).closest(OWNS_PRESS)) return;
          const how = cardClickPick(event, selection.selecting);
          if (how) {
            // Shift-click would otherwise select the text between the two cards.
            event.preventDefault();
            window.getSelection()?.removeAllRanges();
            selection.pick(task.id, how);
            return;
          }
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
    <div className="flex flex-col gap-3" onPointerDown={marquee.onPointerDown}>
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
          {TASK_STATUSES.map((status) => {
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
                          ...filing,
                        })
                      }
                    />
                  ) : (
                    <>
                      <TaskColumnAdd onClick={() => setComposing(status)}>
                        {t('tasks.board.addTask')}
                      </TaskColumnAdd>
                      {folded[status] ? (
                        <TaskColumnMore expanded={Boolean(showOlder)} onClick={toggleOlder}>
                          {showOlder
                            ? t('tasks.board.hideOlder')
                            : t('tasks.board.showOlder', { count: folded[status] })}
                        </TaskColumnMore>
                      ) : null}
                    </>
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
      {marquee.box ? <TaskMarquee rect={marquee.box} /> : null}
      {selection.selecting ? (
        <TaskSelectionBar
          aria-label={t('tasks.selection.label')}
          count={t('tasks.selection.count', { count: selection.picked.length })}
        >
          <MoveTasksMenu
            disabled={bulk.moving}
            onPick={(status) =>
              bulk.run(movesToColumn(selection.picked, status, drag.groups[status] ?? []))
            }
          />
          <IconButton
            size="sm"
            variant="quiet"
            aria-label={t('tasks.selection.delete')}
            title={t('tasks.selection.delete')}
            onClick={() => setDeleting(selection.picked.flatMap((id) => byId.get(id) ?? []))}
          >
            <Trash2 />
          </IconButton>
          <IconButton
            size="sm"
            variant="quiet"
            aria-label={t('tasks.selection.clear')}
            title={t('tasks.selection.clear')}
            onClick={selection.clear}
          >
            <X />
          </IconButton>
        </TaskSelectionBar>
      ) : null}
      {deleting ? (
        <DeleteTasksDialog
          tasks={deleting}
          onLeft={selection.keep}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}
