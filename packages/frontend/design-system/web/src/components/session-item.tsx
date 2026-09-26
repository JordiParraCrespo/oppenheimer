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

/**
 * `action` is the row's ellipsis: an icon button (the trigger of a
 * `DropdownMenu` with Rename, Move to project… and Delete) that only shows
 * on hover, focus, or while its menu is open (`menuOpen`), and hides the age
 * while it does. `rename` swaps the name for a 22px inline input with the
 * primary ring; Enter commits, Escape cancels.
 */
type SessionRename = {
  value: string;
  onValueChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  label?: string;
};

function SessionItem({
  name,
  age,
  state = 'idle',
  active,
  icon,
  action,
  menuOpen,
  rename,
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
  /** The hover-only ellipsis at the row's right edge, 20px. */
  action?: React.ReactNode;
  /** Keeps the row lit and the action visible while its menu is open. */
  menuOpen?: boolean;
  rename?: SessionRename;
}) {
  const withAction = action !== undefined;
  const button = (
    <ButtonPrimitive
      data-slot="session-item"
      data-state={state}
      data-active={active || undefined}
      role={withAction ? undefined : 'listitem'}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group/session flex h-[30px] w-full items-center gap-[9px] rounded-sm px-2.5 text-left text-fg outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring data-active:bg-active-surface [&_svg]:size-3.5 [&_svg]:shrink-0',
        withAction && 'group-hover/row:not-data-active:bg-hover-surface group-data-menu-open/row:not-data-active:bg-hover-surface',
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
      {rename ? (
        <input
          type="text"
          value={rename.value}
          aria-label={rename.label ?? 'Session name'}
          autoFocus
          onChange={(event) => rename.onValueChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onBlur={rename.onCommit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') rename.onCommit();
            if (event.key === 'Escape') rename.onCancel();
          }}
          className="-my-0.5 h-[22px] min-w-0 flex-1 rounded-xs border border-primary bg-card px-1.5 text-[13px] text-fg ring-3 ring-ring outline-none"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-operate tracking-[-0.009em] group-data-active/session:font-medium">
          {name}
        </span>
      )}
      {age && !rename ? (
        <span
          className={cn(
            'figures shrink-0 text-[11px] text-fg opacity-0 transition-opacity duration-fast group-hover/session:opacity-100 group-data-active/session:opacity-100 group-focus-visible/session:opacity-100',
            withAction &&
              'group-hover/row:invisible group-focus-within/row:invisible group-data-menu-open/row:invisible',
          )}
        >
          {age}
        </span>
      ) : null}
    </ButtonPrimitive>
  );

  if (!withAction) return button;
  return (
    <div
      role="listitem"
      data-slot="session-row"
      data-menu-open={menuOpen || undefined}
      className="group/row relative"
    >
      {button}
      {rename ? null : (
      <span className="absolute top-1/2 right-1.5 flex -translate-y-1/2 opacity-0 transition-opacity duration-fast group-hover/row:opacity-100 group-focus-within/row:opacity-100 group-data-menu-open/row:opacity-100 [&_button]:size-5 [&_button]:rounded-xs [&_button]:text-fg-muted [&_button:hover]:text-fg [&_svg:not([class*=size-])]:size-3.5">
        {action}
      </span>
      )}
    </div>
  );
}

export { SessionItem, SessionList };
export type { SessionRename };
