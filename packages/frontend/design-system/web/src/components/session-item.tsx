'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { GitBranchIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import type { StatusState } from './status-dot';

/**
 * SessionItem — the sidebar row for one orchestrated session. There will be
 * hundreds, so the row is a glyph and a name: the branch icon coloured by run
 * state (green running, amber needs input, red failed, grey otherwise), the
 * name truncated, and a mono age that appears on hover and on the active row.
 * A session still provisioning is `pending`: the grey glyph pulses, so a row
 * that joined the list a second ago reads as on its way rather than idle.
 * 30px is the floor; tighter and the pointer target gets unreliable in a long
 * list. Rows sit 1px apart in a `SessionList`.
 */
function SessionList({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="session-list"
      role="list"
      className={cn('flex flex-col gap-px', className)}
      {...props}
    />
  );
}

function SessionItem({
  name,
  age,
  state = 'idle',
  active,
  icon,
  className,
  ...props
}: Omit<ButtonPrimitive.Props, 'children'> & {
  name: string;
  /** Relative age, mono ("2m", "4h"). */
  age?: string;
  state?: StatusState;
  active?: boolean;
  /** Replaces the branch glyph. */
  icon?: React.ReactNode;
}) {
  return (
    <ButtonPrimitive
      data-slot="session-item"
      data-state={state}
      data-active={active || undefined}
      role="listitem"
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group/session flex h-[30px] w-full items-center gap-[9px] rounded-sm px-2.5 text-left text-fg outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring data-active:bg-active-surface [&_svg]:size-3.5 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 text-fg-subtle',
          state === 'running' && 'text-success',
          state === 'needs-input' && 'text-warning',
          state === 'failed' && 'text-danger',
          state === 'pending' && 'motion-safe:animate-pulse',
        )}
      >
        {icon ?? <GitBranchIcon />}
      </span>
      <span className="min-w-0 flex-1 truncate text-operate tracking-[-0.009em] group-data-active/session:font-medium">
        {name}
      </span>
      {age ? (
        <span className="figures shrink-0 text-[11px] text-fg opacity-0 transition-opacity duration-fast group-hover/session:opacity-100 group-data-active/session:opacity-100 group-focus-visible/session:opacity-100">
          {age}
        </span>
      ) : null}
    </ButtonPrimitive>
  );
}

export { SessionItem, SessionList };
