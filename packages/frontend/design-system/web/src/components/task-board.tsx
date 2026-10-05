'use client';

import { CheckIcon, FolderIcon, LayersIcon, PlayIcon, PlusIcon, TerminalIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { dragIgnore, SortableGroup } from './drag';
import { Kbd } from './kbd';
import { dotVariants, type StatusState } from './status-dot';

/**
 * The task board — Plan's tasks by status, one column each, built on the
 * drag layer: a column is a `SortableGroup`, a card sits in a `SortableItem`,
 * and the page's `DragProvider` with `useSortableGroups` moves ids between
 * columns. These parts only draw; which statuses exist, what a move saves
 * and what a click opens are the caller's.
 *
 * - `TaskBoard`: the row of columns, at least 272px each, scrolling sideways
 *   when the pane is narrower than four.
 * - `TaskColumn`: the head (status dot, name, count in mono, a + to add)
 *   over a tray on the hover wash, 18px round, that tints toward the
 *   selected wash while a card would land in it. Its `foot` is the
 *   `TaskColumnAdd` button or a `TaskComposer`.
 * - `TaskCard`: the card in the tray — a round check (green and filled when
 *   done, the title then struck and muted), the title, two lines of notes,
 *   the project and goal, the due date in mono (red when overdue, full ink
 *   when due within a day), the linked session, and Start session on hover.
 */

type TaskStatus = 'later' | 'todo' | 'doing' | 'done';

/** A status's dot: Later is a ring; To do grey; In progress amber; Done green. */
function TaskStatusDot({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span
      aria-hidden
      data-slot="task-status-dot"
      data-status={status}
      className={cn(
        'size-[7px] shrink-0 rounded-pill',
        status === 'later' && 'shadow-[inset_0_0_0_1.5px_var(--fg-subtle)]',
        status === 'todo' && 'bg-fg-subtle',
        status === 'doing' && 'bg-warning',
        status === 'done' && 'bg-success',
        className,
      )}
    />
  );
}

function TaskBoard({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="task-board"
      className={cn('-mx-8 overflow-x-auto overscroll-x-contain px-8 [scrollbar-width:none]', className)}
      {...props}
    >
      <div className="grid w-[max(100%,1124px)] grid-cols-[repeat(4,minmax(272px,1fr))] items-start gap-3">
        {children}
      </div>
    </div>
  );
}

function TaskColumn({
  id,
  status,
  label,
  count,
  items,
  onAdd,
  addLabel,
  foot,
  accepts,
  className,
  children,
}: {
  /** The group id the drag layer moves cards into; usually the status. */
  id: string;
  status: TaskStatus;
  label: React.ReactNode;
  count?: number;
  /** The card ids in this column, in order. */
  items: readonly string[];
  onAdd?: () => void;
  /** The + button's name ("Add task to To do"). */
  addLabel?: string;
  /** Under the cards: `TaskColumnAdd`, or a `TaskComposer` while adding. */
  foot?: React.ReactNode;
  accepts?: readonly string[];
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section data-slot="task-column" data-status={status} className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <div className="flex h-7 items-center gap-[9px] pr-1 pl-2.5">
        <TaskStatusDot status={status} />
        <span className="text-[13.5px] font-medium whitespace-nowrap text-fg">{label}</span>
        {count !== undefined ? <span className="figures text-xs text-fg-subtle">{count}</span> : null}
        <span className="flex-1" />
        {onAdd ? (
          <button
            type="button"
            aria-label={addLabel}
            onClick={onAdd}
            className="flex size-(--control-h-sm) items-center justify-center rounded-pill text-fg-muted outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
          >
            <PlusIcon className="size-[15px]" aria-hidden />
          </button>
        ) : null}
      </div>
      <SortableGroup
        id={id}
        items={items}
        accepts={accepts}
        data={{ type: 'task-column', label: typeof label === 'string' ? label : id }}
        className="flex min-h-[140px] flex-col gap-1.5 rounded-lg bg-hover-surface p-1.5 transition-[background-color] duration-fast ease-standard data-over:bg-[color-mix(in_srgb,var(--selected-surface)_60%,var(--hover-surface))]"
      >
        {children}
        {foot}
      </SortableGroup>
    </section>
  );
}

/** The column's foot: "+ Add task", quiet until hovered. */
function TaskColumnAdd({ className, children, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      data-slot="task-column-add"
      className={cn(
        'flex h-[34px] items-center gap-2 rounded-sm px-2.5 text-[13px] text-fg-subtle outline-none transition-colors duration-fast ease-standard hover:bg-control-hover hover:text-fg-muted focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-3.5',
        className,
      )}
      {...props}
    >
      <PlusIcon aria-hidden />
      {children}
    </button>
  );
}

type TaskDueTone = 'default' | 'soon' | 'overdue';

function TaskCard({
  title,
  notes,
  done = false,
  onToggleDone,
  checkLabel,
  project,
  goal,
  due,
  dueTone = 'default',
  session,
  onStart,
  startLabel = 'Start session',
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  title: React.ReactNode;
  notes?: React.ReactNode;
  done?: boolean;
  onToggleDone?: () => void;
  /** "Mark as done" / "Mark as not done". */
  checkLabel?: string;
  project?: React.ReactNode;
  goal?: React.ReactNode;
  /** Mono, already formatted ("Oct 10", "Tomorrow", "Oct 7 · 14:00"). */
  due?: React.ReactNode;
  dueTone?: TaskDueTone;
  /** A `TaskSessionChip`. */
  session?: React.ReactNode;
  /** Shown on hover while the task has no session and is not done. */
  onStart?: () => void;
  startLabel?: string;
}) {
  const offerStart = Boolean(onStart) && !session && !done;
  const hasMeta = Boolean(project || goal || (due && !done));
  return (
    <div
      data-slot="task-card"
      data-done={done || undefined}
      className={cn(
        'group/task relative flex cursor-grab gap-2.5 rounded-md border border-border-subtle bg-card py-3 pr-3 pl-2.5 transition-[border-color] duration-instant ease-standard hover:border-border',
        className,
      )}
      {...props}
    >
      <button
        type="button"
        aria-label={checkLabel}
        aria-pressed={done}
        onClick={onToggleDone}
        {...dragIgnore}
        className={cn(
          'mt-px flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-pill border-[1.5px] text-white outline-none transition-[background-color,border-color] duration-fast ease-standard focus-visible:outline-2 focus-visible:outline-ring',
          done ? 'border-success bg-success' : 'border-border-strong hover:border-fg-muted',
        )}
      >
        {done ? <CheckIcon className="size-[11px]" strokeWidth={3} aria-hidden /> : null}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span
          className={cn(
            'text-sm leading-[1.38] font-medium tracking-[-0.006em] [overflow-wrap:anywhere] text-pretty',
            done ? 'text-fg-muted line-through decoration-fg-subtle' : 'text-fg',
            offerStart && 'pr-6.5',
          )}
        >
          {title}
        </span>
        {notes && !done ? <span className="line-clamp-2 text-[12.5px] leading-[1.45] text-fg-muted">{notes}</span> : null}
        {hasMeta ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg-muted">
            {project ? (
              <span className="inline-flex max-w-full min-w-0 items-center gap-[5px] truncate">
                <FolderIcon className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{project}</span>
              </span>
            ) : null}
            {goal ? (
              <span className="inline-flex max-w-full min-w-0 items-center gap-[5px]">
                <LayersIcon className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{goal}</span>
              </span>
            ) : null}
            <span className="flex-1" />
            {due && !done ? (
              <span
                data-tone={dueTone}
                className={cn(
                  'figures shrink-0 text-[11.5px]',
                  dueTone === 'overdue' ? 'text-danger' : dueTone === 'soon' ? 'text-fg' : 'text-fg-muted',
                )}
              >
                {due}
              </span>
            ) : null}
          </div>
        ) : null}
        {session}
      </div>
      {offerStart ? (
        <button
          type="button"
          aria-label={startLabel}
          title={startLabel}
          onClick={onStart}
          {...dragIgnore}
          className="absolute top-2 right-2 flex size-(--control-h-sm) items-center justify-center rounded-pill bg-hover-surface text-fg-muted opacity-0 outline-none transition-[opacity,background-color,color] duration-fast ease-standard group-hover/task:opacity-100 hover:bg-control-hover hover:text-fg focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <PlayIcon className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/**
 * A task's session, in its card: the run state's dot and word, the session
 * in mono, how many more are linked, and the terminal glyph. The whole row
 * opens the session in the console.
 */
function TaskSessionChip({
  state,
  word,
  name,
  more,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  state: StatusState;
  /** "Running", "Needs input" — the caller's translation of `state`. */
  word: React.ReactNode;
  name: React.ReactNode;
  /** Linked sessions past this one; shown as "+N". */
  more?: number;
}) {
  return (
    <button
      type="button"
      data-slot="task-session-chip"
      data-state={state}
      {...dragIgnore}
      className={cn(
        'mt-0.5 flex h-7 w-full min-w-0 items-center gap-[7px] rounded-sm bg-hover-surface px-2 text-left text-xs text-fg outline-none transition-colors duration-instant ease-standard hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    >
      <span className={dotVariants({ state: state === 'completed' ? 'idle' : state })} aria-hidden />
      <span className="shrink-0 text-fg-muted">{word}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">{name}</span>
      {more ? <span className="figures shrink-0 text-[11px] text-fg-subtle">+{more}</span> : null}
      <TerminalIcon className="size-3 shrink-0 text-fg-subtle" aria-hidden />
    </button>
  );
}

/**
 * Adding a task at a column's foot: a two-line field on the card with the
 * focus ring, a hint, and ⏎ add · esc cancel. Enter adds; Escape cancels.
 */
function TaskComposer({
  value,
  onValueChange,
  onSubmit,
  onCancel,
  placeholder,
  label,
  hint,
  keys = { add: 'add', cancel: 'cancel' },
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  placeholder?: string;
  /** The field's accessible name ("Task title"). */
  label: string;
  /** Where the task will go ("In XRP Mobile"). */
  hint?: React.ReactNode;
  keys?: { add: string; cancel: string };
  className?: string;
}) {
  return (
    <div
      data-slot="task-composer"
      className={cn(
        'flex flex-col gap-2.5 rounded-md bg-card p-3 shadow-[0_0_0_1px_var(--primary),0_0_0_4px_var(--ring)] motion-safe:animate-appear-fast',
        className,
      )}
    >
      <textarea
        rows={2}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        // biome-ignore lint/a11y/noAutofocus: the composer opens because the reader asked to type.
        autoFocus
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (value.trim()) onSubmit(value.trim());
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
        className="resize-none border-0 bg-transparent p-0 text-sm leading-[1.4] font-medium text-fg outline-none placeholder:font-normal placeholder:text-fg-subtle"
      />
      <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
        <span className="min-w-0 truncate">{hint}</span>
        <span className="flex-1" />
        <Kbd>⏎</Kbd>
        {keys.add}
        <Kbd className="ml-1.5">esc</Kbd>
        {keys.cancel}
      </div>
    </div>
  );
}

export { TaskBoard, TaskCard, TaskColumn, TaskColumnAdd, TaskComposer, TaskSessionChip, TaskStatusDot };
export type { TaskDueTone, TaskStatus };
