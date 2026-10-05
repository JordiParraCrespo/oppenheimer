'use client';

import { CheckIcon, GitMergeIcon, XIcon } from 'lucide-react';
import * as React from 'react';

import { AuthorMark } from '../internal/author-mark';
import { cn } from '../lib/utils';
import { Button } from './button';
import { DiffStat } from './diff-stat';
import { IconButton } from './icon-button';
import { StatusDot, type StatusState } from './status-dot';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

/**
 * The pull request queue: what is waiting on the reader, one row each, on
 * the card. A row is the lane it was sorted into, the title with its
 * `repo #number` in mono and who opened it (a session's bot glyph or a
 * person's), a note when something holds it ("Checks failing"), the size as
 * a `DiffStat`, checks and conflicts on `StatusDot`'s gate states
 * (`passing`, `blocked`, `waiting`) with the caller's word, how long it has
 * waited in mono, and its actions on the right. The title is the row's
 * button, stretched over the row, so the actions beside it are never inside
 * it.
 *
 * The table reads its own width: from 880px it shows Size, Checks and
 * Conflicts as columns; narrower, they fold into one line under the title.
 *
 * - `PullRequestTable` / `PullRequestTableHead` / `PullRequestRow`: the card,
 *   its column heads, a row. The filter row (search and lanes) goes above
 *   the head and `RunsListFoot` under the rows, as on Runs.
 * - The lane (Deep, Medium, Quick: how much reading a change needs) is a
 *   `Badge`, `strong` for Deep and `soft` for the others.
 * - `MergeButton`: Merge, which asks once in place (Cancel, Confirm merge)
 *   before it acts.
 */

const COLUMNS =
  'grid-cols-[84px_minmax(0,1fr)_72px_auto] @[880px]/prq:grid-cols-[80px_minmax(0,1fr)_88px_88px_108px_68px_auto]';

function PullRequestTable({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="pull-request-table"
      role="table"
      className={cn('@container/prq flex flex-col rounded-lg border border-border-subtle bg-card p-1.5', className)}
      {...props}
    />
  );
}

function PullRequestTableHead({
  labels = {},
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  labels?: { lane?: string; title?: string; size?: string; checks?: string; conflicts?: string; waiting?: string };
}) {
  return (
    <div
      role="row"
      data-slot="pull-request-table-head"
      className={cn('grid h-9 items-center gap-4 px-3 text-xs text-fg-subtle', COLUMNS, className)}
      {...props}
    >
      <span role="columnheader">{labels.lane ?? 'Lane'}</span>
      <span role="columnheader">{labels.title ?? 'Pull request'}</span>
      <span role="columnheader" className="hidden text-right @[880px]/prq:block">
        {labels.size ?? 'Size'}
      </span>
      <span role="columnheader" className="hidden @[880px]/prq:block">
        {labels.checks ?? 'Checks'}
      </span>
      <span role="columnheader" className="hidden @[880px]/prq:block">
        {labels.conflicts ?? 'Conflicts'}
      </span>
      <span role="columnheader" className="text-right">
        {labels.waiting ?? 'Waiting'}
      </span>
      <span role="columnheader" aria-hidden />
    </div>
  );
}

function Signal({ state, children }: { state: StatusState; children: React.ReactNode }) {
  return (
    <StatusDot state={state} density="compact" className="text-xs whitespace-nowrap">
      {children}
    </StatusDot>
  );
}

function PullRequestRow({
  lane,
  title,
  reference,
  author,
  authorKind = 'session',
  note,
  noteTone,
  additions,
  deletions,
  checks,
  checksLabel,
  conflicts,
  conflictsLabel,
  waiting,
  waitingTone,
  selected = false,
  onOpen,
  actions,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  /** The lane, a `Badge` (`strong` for Deep, `soft` otherwise). */
  lane: React.ReactNode;
  title: React.ReactNode;
  /** `oppenheimer #482`. */
  reference: React.ReactNode;
  /** "Session · auth-hardening", or a person's name. */
  author?: React.ReactNode;
  authorKind?: 'session' | 'person';
  /** What holds it: "Checks failing", "Waiting · needs a code owner". */
  note?: React.ReactNode;
  noteTone?: 'danger' | 'warning';
  additions: number;
  deletions: number;
  /** A gate state: `passing`, `blocked` (failing) or `waiting` (running). */
  checks: StatusState;
  checksLabel: React.ReactNode;
  /** `passing` when it merges cleanly, `blocked` on conflicts. */
  conflicts: StatusState;
  conflictsLabel: React.ReactNode;
  /** Mono, already formatted: `1d 3h`. */
  waiting: React.ReactNode;
  /** Past the lane's target wait: full ink instead of muted. */
  waitingTone?: 'late';
  selected?: boolean;
  onOpen?: () => void;
  /** The changes `IconButton`, Review, a `MergeButton`. */
  actions?: React.ReactNode;
}) {
  return (
    <div
      role="row"
      data-slot="pull-request-row"
      data-selected={selected || undefined}
      className={cn(
        'relative grid min-h-15.5 items-center gap-4 rounded-sm px-3 py-2.5 transition-colors duration-instant ease-standard has-focus-visible:outline-2 has-focus-visible:outline-ring hover:bg-hover-surface data-selected:bg-hover-surface',
        COLUMNS,
        className,
      )}
      {...props}
    >
      <span role="cell" className="justify-self-start">
        {lane}
      </span>
      <div role="cell" className="flex min-w-0 flex-col gap-1">
        <button
          type="button"
          onClick={onOpen}
          className="truncate text-left text-operate font-medium text-fg outline-none after:absolute after:inset-0 after:rounded-sm after:content-['']"
        >
          {title}
        </button>
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-fg-muted">
          <span className="figures">{reference}</span>
          {author ? (
            <>
              <span aria-hidden className="text-fg-subtle">
                ·
              </span>
              <AuthorMark kind={authorKind}>{author}</AuthorMark>
            </>
          ) : null}
          {note ? (
            <>
              <span aria-hidden className="text-fg-subtle">
                ·
              </span>
              <span className={cn(noteTone === 'danger' ? 'text-danger' : noteTone === 'warning' ? 'text-warning' : 'text-fg-muted')}>
                {note}
              </span>
            </>
          ) : null}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 @[880px]/prq:hidden">
          <Signal state={checks}>{checksLabel}</Signal>
          <Signal state={conflicts}>{conflictsLabel}</Signal>
          <DiffStat additions={additions} deletions={deletions} />
        </span>
      </div>
      <span role="cell" className="hidden justify-self-end @[880px]/prq:block">
        <DiffStat additions={additions} deletions={deletions} />
      </span>
      <span role="cell" className="hidden @[880px]/prq:block">
        <Signal state={checks}>{checksLabel}</Signal>
      </span>
      <span role="cell" className="hidden @[880px]/prq:block">
        <Signal state={conflicts}>{conflictsLabel}</Signal>
      </span>
      <span role="cell" className={cn('figures text-right text-xs', waitingTone === 'late' ? 'text-fg' : 'text-fg-muted')}>
        {waiting}
      </span>
      <div role="cell" className="relative flex items-center justify-end gap-0.5">
        {actions}
      </div>
    </div>
  );
}

/**
 * Merge, asked once in place: the first press turns the button into Cancel
 * and Confirm merge, which rise in where it was; the second acts. Off, with
 * its reason in `disabledReason` as the tooltip, while checks or conflicts
 * hold the pull request.
 */
function MergeButton({
  confirming,
  onConfirmingChange,
  onMerge,
  disabledReason,
  merged = false,
  labels = {},
  className,
}: {
  confirming: boolean;
  onConfirmingChange: (confirming: boolean) => void;
  onMerge: () => void;
  /** Why it cannot merge yet; set, the button is off (and a confirmation open is dropped), and says why on hover, on focus and to a screen reader. */
  disabledReason?: string;
  merged?: boolean;
  labels?: { merge?: string; confirm?: string; confirmTitle?: string; cancel?: string; merged?: string };
  className?: string;
}) {
  const reasonId = React.useId();
  if (merged) {
    return (
      <StatusDot state="completed" density="compact" className={cn('h-7 px-2.5 text-xs whitespace-nowrap', className)}>
        {labels.merged ?? 'Merged'}
      </StatusDot>
    );
  }
  // A merge that became blocked while it asked falls back to the off button and its reason.
  if (confirming && !disabledReason) {
    return (
      <span className={cn('flex items-center gap-0.5 motion-safe:animate-appear-fast', className)}>
        <IconButton size="sm" aria-label={labels.cancel ?? 'Cancel merge'} onClick={() => onConfirmingChange(false)}>
          <XIcon />
        </IconButton>
        <Button size="sm" title={labels.confirmTitle} onClick={onMerge}>
          <CheckIcon />
          {labels.confirm ?? 'Confirm merge'}
        </Button>
      </span>
    );
  }
  const button = (
    <Button
      variant="secondary"
      size="sm"
      disabled={Boolean(disabledReason)}
      focusableWhenDisabled
      aria-describedby={disabledReason ? reasonId : undefined}
      onClick={() => onConfirmingChange(true)}
      className={disabledReason ? undefined : className}
    >
      <GitMergeIcon />
      {labels.merge ?? 'Merge'}
    </Button>
  );
  if (!disabledReason) return button;
  // The off button takes no pointer, so the reason hangs from a wrapper: on hover, on focus, and read with the button.
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cn('inline-flex', className)} />}>
        {button}
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      </TooltipTrigger>
      <TooltipContent>{disabledReason}</TooltipContent>
    </Tooltip>
  );
}

export { MergeButton, PullRequestRow, PullRequestTable, PullRequestTableHead };
