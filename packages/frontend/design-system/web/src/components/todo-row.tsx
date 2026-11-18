'use client';

import { GripVerticalIcon, PlusIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { Checkbox } from './checkbox';
import { dragIgnore, useSortableItem } from './drag';
import { Skeleton } from './skeleton';

/**
 * TodoRow — one task on Plan's TODO, the day's list (the 2026-11-08 `Tasks`
 * frame): a card of its own, 72px tall, with a round `Checkbox` as the done
 * toggle (the success fill once done), the title at 16px semibold over a
 * muted line (its milestone and where it stands), then the time it is due
 * at in mono and its project as a quiet pill. Done strikes the title and
 * mutes the row. The toggle and the title are separate buttons, so ticking a
 * task never opens it. `status` sits before the time (Plan's task status,
 * a `StatusDot` on `TASK_STATUS_STATE`). `action` sits after the project, for what the screen
 * does from a row (TODO's Start session and Move). `children` go last on the row:
 * `SortableTodoRow` puts its grip there.
 *
 * `SortableTodoRow` is the row in a `SortableGroup`. The pointer picks it up
 * anywhere on the card but the done toggle, which never lifts it; a press
 * on the title that moves under 5px is still a click that opens the task.
 * The grip at its right end (six dots) is the keyboard's handle, Space on
 * it lifts the row, and on a touch screen the one part that drags instead
 * of scrolling the page. While it is dragged its place fades.
 *
 * `TodoRowAdd` is the dashed row under the list that adds a task to the day
 * on Enter; `TodoRowSkeleton` stands in for a row while the day loads.
 */
function TodoRow({
  title,
  detail,
  time,
  tag,
  done = false,
  toggleLabel,
  onToggle,
  onOpen,
  status,
  action,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  title: string;
  /** "Atlas public beta · due today". */
  detail?: string;
  /** "10:00": the time it is due at. */
  time?: string;
  /** The project's name; none for a task with no project. */
  tag?: string;
  done?: boolean;
  /** The toggle's name for a screen reader ("Mark done"). */
  toggleLabel: string;
  onToggle?: () => void;
  onOpen?: () => void;
  /** Where the task stands, before the time: a `StatusDot` and its column's name. */
  status?: React.ReactNode;
  /** A control after the project: an `IconButton` the screen acts on the task with. */
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="todo-row"
      data-done={done || undefined}
      className={cn(
        'relative flex min-h-18 items-center gap-4 rounded-lg border border-border-subtle bg-card py-3.5 pr-4 pl-5',
        className,
      )}
      {...props}
    >
      <Checkbox
        {...dragIgnore}
        checked={done}
        onCheckedChange={() => onToggle?.()}
        aria-label={toggleLabel}
        className="size-5.5 rounded-pill data-checked:border-success data-checked:bg-success"
      />
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-0.5 rounded-xs text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          done ? 'text-fg-muted' : 'text-fg',
        )}
      >
        <span className={cn('truncate text-[16px] font-semibold tracking-[-0.011em]', done && 'line-through')}>
          {title}
        </span>
        {detail ? <span className="truncate text-sm text-fg-muted">{detail}</span> : null}
      </button>
      {status}
      {time ? <span className="figures shrink-0 text-sm font-medium text-fg-muted">{time}</span> : null}
      {tag ? (
        <span className="inline-flex h-7 max-w-40 shrink-0 items-center truncate rounded-pill bg-hover-surface px-3 text-sm font-medium text-fg-muted">
          {tag}
        </span>
      ) : null}
      {action}
      {children}
    </div>
  );
}

function SortableTodoRow({
  id,
  gripLabel,
  className,
  style,
  ...props
}: React.ComponentProps<typeof TodoRow> & {
  id: string;
  /** The grip's name for a screen reader ("Reorder Rotate the API keys"). */
  gripLabel: string;
}) {
  const { ref, handleProps, listeners, style: slide, isDragging } = useSortableItem({
    id,
    data: { type: 'todo-row', label: props.title },
  });
  return (
    <TodoRow
      {...props}
      ref={ref}
      onPointerDown={(event) => listeners?.onPointerDown?.(event)}
      data-dragging={isDragging || undefined}
      style={{ ...style, ...slide }}
      className={cn('pr-2 data-dragging:opacity-45', className)}
    >
      <button
        type="button"
        aria-label={gripLabel}
        title={gripLabel}
        {...handleProps}
        className="-ml-1 flex h-11 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-xs text-fg-subtle outline-none transition-colors duration-instant ease-standard hover:text-fg-muted focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
      >
        <GripVerticalIcon aria-hidden className="size-4" />
      </button>
    </TodoRow>
  );
}

function TodoRowAdd({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <div
      data-slot="todo-row-add"
      className={cn(
        'flex min-h-15 items-center gap-4 rounded-lg border border-dashed border-border py-2 pr-4 pl-5',
        className,
      )}
    >
      <span className="flex w-5.5 shrink-0 justify-center text-fg-subtle">
        <PlusIcon aria-hidden className="size-4" />
      </span>
      <input
        type="text"
        className="h-9 min-w-0 flex-1 border-0 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle"
        {...props}
      />
    </div>
  );
}

/** A row while the day loads: the card, the ring and two lines, on the row's own frame. */
function TodoRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="todo-row"
      aria-hidden
      className={cn(
        'flex min-h-18 items-center gap-4 rounded-lg border border-border-subtle bg-card py-3.5 pr-4 pl-5',
        className,
      )}
    >
      <span className="size-5.5 shrink-0 rounded-pill border-[1.5px] border-border-subtle" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton shape="sm" className="h-4 w-56 max-w-full" />
        <Skeleton shape="sm" className="h-3 w-36 max-w-full" />
      </span>
    </div>
  );
}

export { SortableTodoRow, TodoRow, TodoRowAdd, TodoRowSkeleton };
