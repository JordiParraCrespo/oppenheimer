import type * as React from 'react';
import { useState } from 'react';

/**
 * A sidebar row's menu: whether it is open, and the row's `onContextMenu`,
 * which opens it in place of the browser's (at the row's ellipsis, the
 * menu's trigger). Every row with an ellipsis menu takes both from here, so
 * a right-click means the same on each. `enabled: false` leaves the
 * browser's menu to a row whose own is not offered for now (a session being
 * renamed, or a list picking rows).
 */
export function useRowMenu(enabled = true): {
  open: boolean;
  setOpen: (open: boolean) => void;
  onContextMenu: ((event: React.MouseEvent) => void) | undefined;
} {
  const [open, setOpen] = useState(false);
  const onContextMenu = enabled
    ? (event: React.MouseEvent) => {
        event.preventDefault();
        setOpen(true);
      }
    : undefined;
  return { open, setOpen, onContextMenu };
}
