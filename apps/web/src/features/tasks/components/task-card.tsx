import { cn } from '@oppenheimer/design-system-web';
import { Check, Folder, Layers, Play } from '@oppenheimer/design-system-web/icons';
import type { DragEvent, ReactNode } from 'react';

export interface TaskCardView {
  id: string;
  title: string;
  notes: string;
  done: boolean;
  /** Under All projects only: the project the card is filed under. */
  projectName: string | null;
  /** Unless the board is filtered to it. */
  goalName: string | null;
  /** `Tomorrow · 09:00`, or null with no due date or once done. */
  due: string | null;
  dueTone: 'overdue' | 'soon' | 'later';
}

/**
 * A card on the board (`Tasks.dc.html`): the done ring, the title, notes for
 * an open task, the project and goal it is filed under, the due date, and the
 * session line. A card with no session offers Start on hover. Dragging is the
 * column's; the card only starts it.
 */
export function TaskCard({
  task,
  session,
  dragging,
  labels,
  onOpen,
  onToggle,
  onStart,
  onDragStart,
  onDragEnd,
}: {
  task: TaskCardView;
  /** The session line, or nothing for a card with no session. */
  session: ReactNode;
  dragging: boolean;
  labels: { done: string; notDone: string; start: string };
  onOpen: () => void;
  onToggle: () => void;
  /** Absent when the task cannot start a session (it has one, or it is done). */
  onStart?: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a card that is dragged and opened; the button inside it is the toggle.
    <div
      data-card={task.id}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'group/card relative flex cursor-grab gap-2.5 rounded-md border border-border-subtle bg-card py-3 pr-3 pl-2.5 text-left outline-none transition-colors duration-fast hover:border-border focus-visible:outline-2 focus-visible:outline-ring',
        dragging && 'opacity-40',
      )}
    >
      <button
        type="button"
        aria-label={task.done ? labels.notDone : labels.done}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className={cn(
          'mt-px flex size-4.5 shrink-0 items-center justify-center rounded-pill border-[1.5px] transition-colors duration-fast',
          task.done
            ? 'border-success bg-success text-white'
            : 'border-border-strong hover:border-fg-muted',
        )}
      >
        {task.done ? <Check className="size-2.75" strokeWidth={3} aria-hidden /> : null}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span
          className={cn(
            'text-14 font-medium leading-[1.38] tracking-[-0.006em] text-pretty [overflow-wrap:anywhere]',
            task.done ? 'text-fg-muted line-through decoration-fg-subtle' : 'text-fg',
            onStart && 'pr-6.5',
          )}
        >
          {task.title}
        </span>
        {task.notes && !task.done ? (
          <span className="line-clamp-2 text-sm text-fg-muted">{task.notes}</span>
        ) : null}
        {task.projectName || task.goalName || task.due ? (
          <div className="flex flex-col gap-1 text-xs text-fg-muted">
            {task.projectName ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <Folder className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{task.projectName}</span>
              </span>
            ) : null}
            {task.goalName ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <Layers className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{task.goalName}</span>
              </span>
            ) : null}
            {task.due ? (
              <span
                className={cn(
                  'figures self-end font-mono text-xs',
                  task.dueTone === 'overdue' && 'text-danger',
                  task.dueTone === 'soon' && 'text-fg',
                )}
              >
                {task.due}
              </span>
            ) : null}
          </div>
        ) : null}
        {session}
      </div>
      {onStart ? (
        <button
          type="button"
          aria-label={labels.start}
          title={labels.start}
          onClick={(event) => {
            event.stopPropagation();
            onStart();
          }}
          className="absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-pill text-fg-muted opacity-0 transition-opacity duration-fast group-hover/card:opacity-100 hover:bg-hover-surface hover:text-fg focus-visible:opacity-100"
        >
          <Play className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
