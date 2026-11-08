'use client';

import { PlusIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { Checkbox } from './checkbox';
import { Skeleton } from './skeleton';

/**
 * TodoRow — one task on Plan's To do, the day's list (the 2026-11-08 `Tasks`
 * frame): a card of its own, 72px tall, with a round `Checkbox` as the done
 * toggle (the success fill once done), the title at 16px semibold over a
 * muted line (its milestone and where it stands), then the time it is due
 * at in mono and its project as a quiet pill. Done strikes the title and
 * mutes the row. The toggle and the title are separate buttons, so ticking a
 * task never opens it.
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
  className,
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
      {time ? <span className="figures shrink-0 text-sm font-medium text-fg-muted">{time}</span> : null}
      {tag ? (
        <span className="inline-flex h-7 max-w-40 shrink-0 items-center truncate rounded-pill bg-hover-surface px-3 text-sm font-medium text-fg-muted">
          {tag}
        </span>
      ) : null}
    </div>
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

export { TodoRow, TodoRowAdd, TodoRowSkeleton };
