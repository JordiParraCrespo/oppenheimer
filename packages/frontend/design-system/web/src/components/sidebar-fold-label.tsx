import { ChevronDownIcon } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../lib/utils';

/**
 * SidebarFoldLabel — a `SidebarListHead` label that folds the list under it:
 * the name, then a chevron that shows on hover and focus and stays, turned
 * right, while the list is folded. The head stays the layout; the caller
 * passes this as its `label` and leaves the list out while `open` is false.
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
  return (
    <button
      type="button"
      data-slot="sidebar-fold-label"
      aria-expanded={open}
      onClick={() => onOpenChange(!open)}
      className={cn(
        'group/fold inline-flex max-w-full items-center gap-1 text-left outline-none transition-colors duration-fast hover:text-fg focus-visible:text-fg',
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

export { SidebarFoldLabel };
