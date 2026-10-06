'use client';

import { FolderIcon, LayersIcon, PlayIcon, PlusIcon, TerminalIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { Checkbox } from './checkbox';
import { dragIgnore, SortableGroup } from './drag';
import { Kbd } from './kbd';
import { IconButton } from './icon-button';
import { StatusDot, type StatusState } from './status-dot';

/**
 * The task board — Plan's tasks by status, one column each, built on the
 * drag layer: a column is a `SortableGroup`, a card sits in a `SortableItem`,
 * and the page's `DragProvider` with `useSortableGroups` moves ids between
 * columns. These parts only draw; which statuses exist, what a move saves
 * and what a click opens are the caller's.
 *
 * - `TaskBoard`: one row of however many columns it is given, at least
 *   272px each, scrolling sideways when the parent is narrower. It is as
 *   wide as its parent, and `gutter` lets the scroller alone reach into the
 *   page's.
 * - `TaskColumn`: the head (the status on `StatusDot`, the count in mono, a
 *   + to add)
 *   over a tray on the hover wash, 18px round, that tints toward the
 *   selected wash while a card would land in it. Its `foot` is the
 *   `TaskColumnAdd` button or a `TaskComposer`.
 * - `TaskCard`: the card in the tray — a round `Checkbox` (green when
 *   done, the title then struck and muted), the title, two lines of notes,
 *   the project and goal, the due date in mono (red when overdue, full ink
 *   when due within a day), the linked session, and Start session on hover.
 */

type TaskStatus = 'later' | 'todo' | 'doing' | 'done';

/**
 * A task's status on the run-state vocabulary, so a task reads with the
 * same dot as everything else: Later is pending, To do idle, In progress
 * running, and Done completed (the check, since a done task is finished).
 */
const TASK_STATUS_STATE: Record<TaskStatus, StatusState> = {
  later: 'pending',
  todo: 'idle',
  doing: 'running',
  done: 'completed',
};

function TaskBoard({
  gutter,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  /**
   * The page's gutter, and the margin that cancels it, as the page states
   * them (`-mx-8 px-8`). It is a prop rather than the caller's `className`
   * because the padding has to sit on the element that scrolls: that is what
   * keeps the columns on the page's measure while a card scrolled past the
   * edge passes under the gutter instead of starting in it. The board holds
   * no gutter of its own — whose it is, and how wide, is the page's.
   */
  gutter?: string;
}) {
  return (
    <div
      data-slot="task-board"
      className={cn('overflow-x-auto overscroll-x-contain [scrollbar-width:none]', gutter, className)}
      {...props}
    >
      <div className="grid auto-cols-[minmax(272px,1fr)] grid-flow-col items-start gap-3">{children}</div>
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
      <div className="flex h-7 items-center gap-2 pr-1 pl-1.5">
        <StatusDot state={TASK_STATUS_STATE[status]} density="compact" className="font-medium whitespace-nowrap">
          {label}
        </StatusDot>
        {count !== undefined ? <span className="figures text-xs text-fg-subtle">{count}</span> : null}
        <span className="flex-1" />
        {onAdd ? (
          <IconButton size="sm" aria-label={addLabel} onClick={onAdd}>
            <PlusIcon aria-hidden />
          </IconButton>
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
        'flex h-[34px] items-center gap-2 rounded-sm px-2.5 text-sm text-fg-subtle outline-none transition-colors duration-fast ease-standard hover:bg-control-hover hover:text-fg-muted focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-3.5',
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
      <Checkbox
        aria-label={checkLabel}
        checked={done}
        onCheckedChange={() => onToggleDone?.()}
        {...dragIgnore}
        className="mt-px cursor-pointer rounded-pill data-checked:border-success data-checked:bg-success"
      />
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
        {notes && !done ? <span className="line-clamp-2 text-xs leading-[1.45] text-fg-muted">{notes}</span> : null}
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
                  'figures shrink-0 text-micro',
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
      <StatusDot state={state} density="compact" className="shrink-0 text-xs text-fg-muted">
        {word}
      </StatusDot>
      <span className="min-w-0 flex-1 truncate font-mono text-micro">{name}</span>
      {more ? <span className="figures shrink-0 text-micro text-fg-subtle">+{more}</span> : null}
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

export { TASK_STATUS_STATE, TaskBoard, TaskCard, TaskColumn, TaskColumnAdd, TaskComposer, TaskSessionChip };
export type { TaskDueTone, TaskStatus };
