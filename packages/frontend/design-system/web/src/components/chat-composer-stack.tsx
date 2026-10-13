'use client';

import { CheckIcon, LoaderIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * What sits on top of the chat's composer (Chat Components, Above the
 * composer). Panels fuse onto the field: rounded on top, open at the
 * bottom, on the hover wash, hairlines between sections. Top to bottom:
 * the goal, the tasks, the live changes, the queue, then the input.
 *
 * - `ComposerStack`: the fused panel; its children are `ComposerStackRow`s
 *   and `ComposerTaskList`s, a hairline between each.
 * - `ComposerStackRow`: one line, 13.5px: a glyph, the text, then its
 *   actions (24px hairline pills: Review, Resume, Steer; icon buttons).
 * - `ComposerTaskList`: the agent's task list under its count row: a
 *   tick, a spinner or an open ring, the number in mono, the task; done
 *   ones struck through in subtle ink.
 * - `ComposerStackAction`: the 24px pill those rows act with.
 * - `ComposerNotice`: one fact with at most one action, alone on the field
 *   (a tip, a branch mismatch, a snooze, a reconnect); the same fused shape
 *   as the stack, one row tall.
 */
function ComposerStack({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="composer-stack"
      className={cn(
        'flex flex-col divide-y divide-border-subtle overflow-hidden rounded-t-lg border border-b-0 border-border-subtle bg-hover-surface text-[13.5px] text-fg',
        className,
      )}
      {...props}
    />
  );
}

function ComposerStackRow({
  icon,
  actions,
  muted = false,
  className,
  children,
}: {
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  /** The row's text in muted ink, its lead word in full (`<strong>`). */
  muted?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="composer-stack-row"
      className={cn(
        'flex min-h-10 items-center gap-2 py-1.5 pr-1.5 pl-3',
        muted && 'text-fg-muted [&_strong]:font-medium [&_strong]:text-fg',
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className="flex shrink-0 text-fg-muted [&_svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {actions ? <span className="flex shrink-0 items-center gap-1">{actions}</span> : null}
    </div>
  );
}

function ComposerStackAction({
  variant = 'outline',
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'type'> & { variant?: 'outline' | 'quiet' }) {
  return (
    <button
      type="button"
      data-slot="composer-stack-action"
      className={cn(
        'inline-flex h-6 shrink-0 items-center rounded-pill px-2.5 text-[12.5px] outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring',
        variant === 'outline' ? 'border border-border text-fg hover:bg-hover-surface' : 'text-fg-muted hover:bg-control-hover hover:text-fg',
        className,
      )}
      {...props}
    />
  );
}

type ComposerTask = { id: string; label: React.ReactNode; state: 'done' | 'running' | 'todo' };

function ComposerTaskList({
  tasks,
  foot,
  className,
}: {
  tasks: readonly ComposerTask[];
  /** A line under the list ("1 background agent"). */
  foot?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="composer-task-list" className={cn('flex flex-col', className)}>
      <ol className="m-0 flex list-none flex-col px-3 pt-1 pb-2">
        {tasks.map((task, i) => (
          <li key={task.id} className="flex items-start gap-2 py-1">
            <span
              className={cn(
                'flex items-center gap-1.5 pt-0.5',
                task.state === 'done' ? 'text-success' : task.state === 'running' ? 'text-fg' : 'text-fg-subtle',
              )}
            >
              <span aria-hidden className="flex w-3.5 justify-center">
                {task.state === 'done' ? <CheckIcon className="size-3.25" /> : null}
                {task.state === 'running' ? <LoaderIcon className="size-3.25 motion-safe:animate-spin" /> : null}
                {task.state === 'todo' ? <span className="size-1.75 rounded-pill border border-current" /> : null}
              </span>
              <span className="figures font-mono text-[12px]">{i + 1}</span>
            </span>
            <span
              className={cn(
                'flex-1 leading-[1.45]',
                task.state === 'done' ? 'text-fg-subtle line-through' : task.state === 'running' ? 'text-fg' : 'text-fg-muted',
              )}
            >
              {task.label}
            </span>
          </li>
        ))}
      </ol>
      {foot ? (
        <div className="flex items-center gap-1.5 border-t border-border-subtle px-3 py-1.75 text-[12.5px] text-fg-muted [&_svg]:size-3.25">
          {foot}
        </div>
      ) : null}
    </div>
  );
}

function ComposerNotice({
  icon,
  action,
  className,
  children,
}: {
  /** A glyph, or a 6px dot (`<span className="size-1.5 …" />`) for a live state. */
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="composer-notice"
      role="status"
      className={cn(
        'flex items-center gap-2 rounded-t-lg border border-b-0 border-border-subtle bg-hover-surface py-2 pr-1.5 pl-3 text-[13.5px] text-fg',
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className="flex shrink-0 text-fg-muted [&_svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export { ComposerNotice, ComposerStack, ComposerStackAction, ComposerStackRow, ComposerTaskList };
export type { ComposerTask };
