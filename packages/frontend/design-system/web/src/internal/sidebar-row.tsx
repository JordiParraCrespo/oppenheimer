import type * as React from 'react';

import { dragIgnore } from '../components/drag';
import { cn } from '../lib/utils';

/**
 * Added to a sidebar row's button when the row has an action, so its hover
 * wash stays lit while the pointer is on the ellipsis or its menu is open.
 */
export const ROW_BUTTON_WITH_ACTION =
  'group-hover/row:not-data-active:bg-hover-surface group-data-menu-open/row:not-data-active:bg-hover-surface';

/** Added to the row's trailing meta (an age, a countdown) so it gives way to the action. */
export const META_GIVES_WAY =
  'group-hover/row:invisible group-focus-within/row:invisible group-data-menu-open/row:invisible';

/**
 * The shell a sidebar row takes when it has an action (`SessionItem`,
 * `RoutineItem`): the list item around the row's button, and the 20px
 * ellipsis over its right edge, shown on hover, on focus within, or while
 * its menu is open (`menuOpen`). The button inside drops its own
 * `role="listitem"` and adds `ROW_BUTTON_WITH_ACTION`; its meta adds
 * `META_GIVES_WAY`.
 */
export function SidebarRow({
  slot,
  action,
  menuOpen,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  /** `data-slot` of the shell ("session-row", "routine-row"). */
  slot: string;
  /** The ellipsis; left out while the row hides it (an inline rename). */
  action?: React.ReactNode;
  menuOpen?: boolean;
}) {
  return (
    <div
      role="listitem"
      data-slot={slot}
      data-menu-open={menuOpen || undefined}
      className={cn('group/row relative', className)}
      {...props}
    >
      {children}
      {action ? (
        // A press on the ellipsis or its menu is the menu's, never the start of a row's drag.
        <span
          {...dragIgnore}
          className="absolute top-1/2 right-1.5 flex -translate-y-1/2 opacity-0 transition-opacity duration-fast group-hover/row:opacity-100 group-focus-within/row:opacity-100 group-data-menu-open/row:opacity-100 [&_button]:size-5 [&_button]:rounded-xs [&_button]:text-fg-muted [&_button:hover]:text-fg [&_svg:not([class*=size-])]:size-3.5"
        >
          {action}
        </span>
      ) : null}
    </div>
  );
}
