import type * as React from 'react';

import { cn } from '../lib/utils';
import { CommandRow, CommandRowList } from './command-row';
import { Skeleton } from './skeleton';

type HostCardStatus = 'running' | 'idle' | 'offline';

// Two columns, the dot's and the rest, so the detail lines up with the name
// because it sits in the same column, not by an offset.
const FRAME = 'grid grid-cols-[7px_minmax(0,1fr)] gap-x-3.5 rounded-lg border border-border-subtle bg-card pr-4 pl-5';

/** What an offline host is holding up, and how to bring it back. */
type HostCardOffline = {
  /** What waits on it: sessions that reconnect on their own, queued runs, a runner out of date. */
  note: React.ReactNode;
  /** The commands to run on the machine, each with its lead line. */
  commands?: { lead?: React.ReactNode; command: string }[];
  /** The one action (a secondary small Check again, `pending` while it looks). */
  action?: React.ReactNode;
  /** Mono, beside the action: the answer ("still offline · checked just now"). */
  actionNote?: React.ReactNode;
};

/**
 * HostCard — one card per host on the Settings page: a status dot on the
 * left (green running, grey idle, a hollow grey ring when offline), the
 * mono name and a meta line (OS, size, region, runner version), the state
 * and last-seen on the right in mono, and an ellipsis for the host's menu
 * (Rename, Remove host). Measured against
 * `design/version1/Components.dc.html` ("Host card").
 *
 * `offline` opens the host's detail under a hairline, in the name's column:
 * the note, the commands as `CommandRow`s, and the action with its answer.
 * The console cannot reconnect a runner (the runner dials out), so the card
 * explains and looks again; it never offers to reconnect.
 */
function HostCard({
  name,
  meta,
  status,
  state,
  seen,
  action,
  rename,
  offline,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  name: React.ReactNode;
  meta?: React.ReactNode;
  status: HostCardStatus;
  /** "Running · 2 sessions", "Idle", "Offline". */
  state: React.ReactNode;
  /** Mono: "connected", "last seen 2 days ago". */
  seen?: React.ReactNode;
  action?: React.ReactNode;
  /** The inline rename row, drawn where the name is while it is open. */
  rename?: React.ReactNode;
  /** An offline host's detail. */
  offline?: HostCardOffline;
}) {
  return (
    <div
      data-slot="host-card"
      data-status={status}
      className={cn(FRAME, className)}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'size-[7px] self-center rounded-pill',
          status === 'running' && 'bg-success',
          status === 'idle' && 'bg-fg-subtle',
          status === 'offline' && 'border-[1.5px] border-fg-subtle',
        )}
      />
      <div className="flex items-center gap-3.5 py-4.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.75">
          {rename ?? <span className="truncate font-mono text-operate text-fg">{name}</span>}
          {meta ? <span className="truncate text-[12.5px] text-fg-muted">{meta}</span> : null}
        </div>
        <div className="flex min-w-30 shrink-0 flex-col items-end gap-0.75 text-right">
          <span className="text-[13px] text-fg">{state}</span>
          {seen ? <span className="figures text-[11.5px] text-fg-subtle">{seen}</span> : null}
        </div>
        {action ? <span className="shrink-0 [&_button]:text-fg-muted [&_button:hover]:text-fg">{action}</span> : null}
      </div>
      {offline ? (
        <div
          data-slot="host-card-offline"
          className="col-start-2 flex flex-col gap-3.5 border-t border-border-subtle pt-4.5 pb-5"
        >
          <p className="m-0 max-w-[62ch] text-[13px] leading-normal text-fg-muted text-pretty">{offline.note}</p>
          {offline.commands?.length ? (
            <CommandRowList>
              {offline.commands.map((c) => (
                <CommandRow key={c.command} lead={c.lead} command={c.command} />
              ))}
            </CommandRowList>
          ) : null}
          {offline.action || offline.actionNote ? (
            <div className="flex flex-wrap items-center gap-3">
              {offline.action}
              {offline.actionNote ? (
                <span className="figures font-mono text-[11.5px] text-fg-subtle">{offline.actionNote}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const SKELETON_NAMES = ['w-32', 'w-24', 'w-28'] as const;
const SKELETON_METAS = ['w-56', 'w-44', 'w-48'] as const;

/**
 * A card's place while the hosts have not answered: the card's frame and
 * columns, a bar for the dot, the name and meta line, the state and last-seen,
 * and the menu's control, each at its line's height, so the card that
 * replaces it lands where it stood. `index` varies the widths.
 */
function HostCardSkeleton({ index = 0, className, ...props }: React.ComponentProps<'div'> & { index?: number }) {
  return (
    <div aria-hidden data-slot="host-card-skeleton" className={cn(FRAME, className)} {...props}>
      <Skeleton shape="pill" className="size-[7px] self-center" />
      <div className="flex items-center gap-3.5 py-4.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.75">
          <span className="flex h-5 items-center">
            <Skeleton shape="sm" className={cn('h-3', SKELETON_NAMES[index % SKELETON_NAMES.length])} />
          </span>
          <span className="flex h-4.5 items-center">
            <Skeleton shape="sm" className={cn('h-2.5 max-w-full', SKELETON_METAS[index % SKELETON_METAS.length])} />
          </span>
        </div>
        <div className="flex min-w-30 shrink-0 flex-col items-end gap-0.75">
          <span className="flex h-4.75 items-center">
            <Skeleton shape="sm" className="h-2.5 w-16" />
          </span>
          <span className="flex h-4.25 items-center">
            <Skeleton shape="sm" className="h-2 w-20" />
          </span>
        </div>
        <span className="flex size-(--control-h-sm) shrink-0 items-center justify-center">
          <Skeleton shape="sm" className="size-3.5" />
        </span>
      </div>
    </div>
  );
}

export { HostCard, HostCardSkeleton };
export type { HostCardOffline, HostCardStatus };
