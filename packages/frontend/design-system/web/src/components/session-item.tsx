'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { GitBranchIcon } from 'lucide-react';
import type * as React from 'react';

import { META_GIVES_WAY, ROW_BUTTON_WITH_ACTION, SidebarRow } from '../internal/sidebar-row';
import { cn } from '../lib/utils';
import { useSortableItem } from './drag';
import type { StatusState } from './status-dot';

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
 * `rename` swaps the name for a 22px inline input with the primary ring; Enter
 * commits, Escape cancels.
 */
type SessionRename = {
  value: string;
  onValueChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  label?: string;
};

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
  render,
  nativeButton,
  ...props
}: Omit<ButtonPrimitive.Props, 'children'> & {
  name: string;
  /** Relative age, mono ("2m", "4h"). */
  age?: string;
  state?: StatusState;
  active?: boolean;
  /** Replaces the branch glyph. */
  icon?: React.ReactNode;
  /**
   * The row's 20px ellipsis (the trigger of a `DropdownMenu` with Rename, Move
   * to project… and Delete): shown on hover, focus, or while its menu is open
   * (`menuOpen`), and hiding the age while it is.
   */
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
      // A row rendered as a router link is an anchor, not a <button>: Base UI
      // keeps link semantics only when told so, as Button does.
      render={render}
      nativeButton={nativeButton ?? render === undefined}
      className={cn(
        'group/session flex h-[30px] w-full items-center gap-[9px] rounded-sm px-2.5 text-left text-fg outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring data-active:bg-active-surface [&_svg]:size-3.5 [&_svg]:shrink-0',
        withAction && ROW_BUTTON_WITH_ACTION,
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
            withAction && META_GIVES_WAY,
          )}
        >
          {age}
        </span>
      ) : null}
    </ButtonPrimitive>
  );

  if (!withAction) return button;
  return (
    <SidebarRow slot="session-row" action={rename ? undefined : action} menuOpen={menuOpen}>
      {button}
    </SidebarRow>
  );
}

/**
 * SortableSessionItem — a `SessionItem` the reader can drag: up or down in
 * its project, or into another project's list (the project is the
 * `SortableGroup`, so a folded or empty one still takes it). It sits in the
 * shell's `DragProvider`; where the order and the project are kept is the
 * app's (`useSortableGroups`' `onMove`). A click still opens the session and
 * a drag starts after 5px; on the keyboard Enter opens it and Space picks
 * it up. The row is still while it is being renamed, and its place is the
 * drop slot while it moves.
 */
function SortableSessionItem({
  id,
  disabled,
  className,
  ...props
}: Omit<React.ComponentProps<typeof SessionItem>, 'onPointerDown' | 'onKeyDown' | 'disabled'> & {
  id: string;
  /** No drag: a filtered list, where the neighbours on screen are not the order. */
  disabled?: boolean;
}) {
  const { ref, handleProps, style, isDragging } = useSortableItem({
    id,
    data: { type: 'session', label: props.name },
    disabled: disabled || props.rename !== undefined,
    pickUp: 'space',
  });
  // The row keeps its own role (a list item, or the button inside one) and is never announced as disabled.
  const { role: _role, 'aria-disabled': _disabled, ...handle } = handleProps;
  return (
    <div
      ref={ref}
      data-slot="sortable-session"
      data-dragging={isDragging || undefined}
      style={style}
      className={cn(
        'touch-none rounded-sm data-dragging:bg-selected-surface data-dragging:shadow-[inset_0_0_0_1px_var(--ring)] data-dragging:[&>*]:invisible',
        className,
      )}
    >
      <SessionItem {...props} {...handle} />
    </div>
  );
}

export { SessionItem, SessionList, SortableSessionItem };
export type { SessionRename };
