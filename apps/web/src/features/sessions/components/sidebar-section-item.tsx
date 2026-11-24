import { cn, useSortableItem } from '@oppenheimer/design-system-web';
import { GripVertical } from '@oppenheimer/design-system-web/icons';
import type { PointerEvent, ReactNode } from 'react';

/**
 * One of the sessions sidebar's sections (Bots, Sessions) as an item of the
 * sidebar's section order. It is picked up by pressing its heading (the
 * `SidebarListHead` inside it) and dragging, so a press on a row below never
 * moves the section, or from the keyboard on the grip that shows in the
 * heading's gutter on hover and focus. While carried, its place keeps its
 * height as the drop slot. `grow` lets the section that scrolls (Sessions)
 * take the height left while it is open.
 */
export function SidebarSectionItem({
  id,
  label,
  moveLabel,
  grow = false,
  children,
}: {
  id: string;
  /** The section's name, for the lifted copy and what a screen reader hears. */
  label: string;
  /** The grip's accessible name. */
  moveLabel: string;
  grow?: boolean;
  children: ReactNode;
}) {
  const { ref, handleProps, listeners, style, isDragging } = useSortableItem({
    id,
    data: { type: 'sidebar-section', label },
  });
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const head = (event.target as Element).closest('[data-slot="sidebar-list-head"]');
    if (head && event.currentTarget.contains(head)) listeners?.onPointerDown?.(event);
  };

  return (
    <div
      ref={ref}
      // The slide while the other section makes room is data-driven.
      // oxlint-disable-next-line no-inline-styles
      style={style}
      data-dragging={isDragging || undefined}
      onPointerDown={onPointerDown}
      className={cn(
        'group/section relative flex flex-col data-dragging:rounded-md data-dragging:bg-selected-surface data-dragging:shadow-[inset_0_0_0_1px_var(--ring)] data-dragging:[&>*]:invisible',
        grow ? 'min-h-0 flex-1' : 'shrink-0',
      )}
    >
      <button
        type="button"
        aria-label={moveLabel}
        {...handleProps}
        className="absolute top-0 left-px z-10 flex h-(--control-h-sm) w-2.5 cursor-grab items-center justify-center rounded-sm text-fg-subtle opacity-0 outline-none transition-opacity duration-fast group-hover/section:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <GripVertical aria-hidden className="size-3" />
      </button>
      {children}
    </div>
  );
}
