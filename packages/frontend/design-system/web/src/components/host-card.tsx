import type * as React from 'react';

import { cn } from '../lib/utils';

type HostCardStatus = 'running' | 'idle' | 'offline';

/**
 * HostCard — one card per host on the Settings page: a status dot on the
 * left (green running, grey idle, a hollow grey ring when offline), the
 * mono name and a meta line (OS, size, region, runner version), the state
 * and last-seen on the right in mono, and an ellipsis for the host's menu
 * (Rename, Remove host). Measured against
 * `design/version1/Components.dc.html` ("Host card").
 *
 * An offline host opens a `detail` under a hairline, indented to the name:
 * what is waiting on it (`HostCardNote`), the commands that bring the runner
 * back (`CommandRowList`), and `HostCardFoot` with Check again and when it last
 * looked. The console cannot reconnect a runner (the runner dials out), so
 * the card only explains, and looks again.
 */
function HostCard({
  name,
  meta,
  status,
  state,
  seen,
  action,
  rename,
  detail,
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
  /** Under the row, behind a hairline: what an offline host is holding up, and the fix. */
  detail?: React.ReactNode;
}) {
  return (
    <div
      data-slot="host-card"
      data-status={status}
      className={cn('flex flex-col rounded-lg border border-border-subtle bg-card', className)}
      {...props}
    >
      <div className="flex items-center gap-3.5 py-4.5 pr-4 pl-5">
      <span
        aria-hidden
        className={cn(
          'size-[7px] shrink-0 rounded-pill',
          status === 'running' && 'bg-success',
          status === 'idle' && 'bg-fg-subtle',
          status === 'offline' && 'border-[1.5px] border-fg-subtle',
        )}
      />
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
      {detail ? (
        <div
          data-slot="host-card-detail"
          className="mr-4 ml-[41px] flex flex-col gap-3.5 border-t border-border-subtle pt-4.5 pb-5"
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}

/** The detail's opening sentence: what reconnects on its own, what waits, what is out of date. */
function HostCardNote({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="host-card-note"
      className={cn('m-0 max-w-[62ch] text-[13px] leading-normal text-fg-muted text-pretty', className)}
      {...props}
    />
  );
}

/**
 * The detail's last row: the action (a secondary small Check again, `pending`
 * while it looks) and a mono note of the answer ("still offline · checked
 * just now").
 */
function HostCardFoot({
  note,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { note?: React.ReactNode }) {
  return (
    <div data-slot="host-card-foot" className={cn('flex flex-wrap items-center gap-3', className)} {...props}>
      {children}
      {note ? <span className="figures font-mono text-[11.5px] text-fg-subtle">{note}</span> : null}
    </div>
  );
}

export { HostCard, HostCardFoot, HostCardNote };
export type { HostCardStatus };
