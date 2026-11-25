'use client';

import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { ChevronDownIcon } from 'lucide-react';
import * as React from 'react';
import { SidebarSectionHandle } from '../internal/sidebar-section-handle';
import { cn } from '../lib/utils';

/**
 * SidebarFoldLabel — a `SidebarListHead` label that folds the list under it:
 * the name, uppercase like the head it sits in, then a chevron that shows on
 * hover and focus and stays, turned right, while the list is folded. The head
 * stays the layout; the caller passes this as its `label` and puts the list
 * in a `SidebarFoldPanel` given the same `open`. Inside a
 * `SortableSidebarSection` it is the section's keyboard control: Space picks
 * the section up, Enter folds it.
 */
function SidebarFoldLabel({
  open,
  onOpenChange,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'button'>, 'onClick'> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const sortable = React.useContext(SidebarSectionHandle);
  return (
    <button
      type="button"
      {...sortable?.control}
      data-slot="sidebar-fold-label"
      aria-expanded={open}
      onClick={() => onOpenChange(!open)}
      className={cn(
        'group/fold inline-flex max-w-full items-center gap-1 text-left uppercase outline-none transition-colors duration-fast hover:text-fg focus-visible:text-fg',
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      <ChevronDownIcon
        aria-hidden
        className={cn(
          'size-3.25 shrink-0 opacity-0 transition-[opacity,rotate] duration-base ease-standard group-hover/fold:opacity-100 group-focus-visible/fold:opacity-100',
          !open && '-rotate-90 opacity-100',
        )}
      />
    </button>
  );
}

/**
 * SidebarFoldPanel — the list a `SidebarFoldLabel` folds. It closes on its own
 * height, fading as it goes, and opens the same way, at the base duration
 * (Base UI measures `--collapsible-panel-height`); reduced motion keeps the
 * jump. Its children are unmounted once it has closed.
 */
function SidebarFoldPanel({
  open,
  className,
  ...props
}: Omit<CollapsiblePrimitive.Panel.Props, 'keepMounted'> & { open: boolean }) {
  return (
    <CollapsiblePrimitive.Root open={open}>
      <CollapsiblePrimitive.Panel
        data-slot="sidebar-fold-panel"
        className={cn(
          'h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-base ease-standard data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none',
          className,
        )}
        {...props}
      />
    </CollapsiblePrimitive.Root>
  );
}

export { SidebarFoldLabel, SidebarFoldPanel };
