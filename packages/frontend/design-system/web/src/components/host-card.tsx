import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * HostCard — one card per host on the Settings page: a status dot on the
 * left (green running, grey idle, a hollow ring when offline), the mono
 * name and a meta line (OS, size, region, runner version), the state and
 * last-seen on the right in mono, and an ellipsis whose menu holds
 * Rename, Copy host ID and Remove host.
 */
type HostCardStatus = 'running' | 'idle' | 'offline';

function HostCard({
  name,
  meta,
  status,
  state,
  seen,
  action,
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
}) {
  return (
    <div
      data-slot="host-card"
      data-status={status}
      className={cn(
        'flex items-center gap-4 rounded-lg border border-border-subtle bg-card py-4 pr-3.5 pl-5',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'size-[7px] shrink-0 rounded-pill',
          status === 'running' && 'bg-success',
          status === 'idle' && 'bg-fg-subtle',
          status === 'offline' && 'border-[1.5px] border-fg-subtle',
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-mono text-[13.5px] text-fg">{name}</span>
        {meta ? <span className="truncate text-[12.5px] text-fg-muted">{meta}</span> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <span className="text-[13px] text-fg">{state}</span>
        {seen ? <span className="figures text-[11px] text-fg-subtle">{seen}</span> : null}
      </div>
      {action ? <span className="shrink-0 [&_button]:text-fg-muted [&_button:hover]:text-fg">{action}</span> : null}
    </div>
  );
}

export { HostCard };
export type { HostCardStatus };
