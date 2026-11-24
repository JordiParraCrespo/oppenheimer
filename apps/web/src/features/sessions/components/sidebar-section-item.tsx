import { cn, useSortableItem } from '@oppenheimer/design-system-web';
import { GripVertical } from '@oppenheimer/design-system-web/icons';
import { type KeyboardEvent, type PointerEvent, type ReactNode, useId, useRef } from 'react';

/**
 * One of the sessions sidebar's sections (Bots, Sessions) as an item of the
 * sidebar's section order. It is picked up by pressing its heading (the
 * `SidebarListHead` inside it, its label or its empty space) and dragging,
 * so a press on a row below or on a heading's own menu button never moves
 * the section. From the keyboard, the grip that shows in the heading's
 * gutter on hover and focus moves it one place with the up and down arrows
 * (`onStep`), straight away: the drag layer's keyboard lift picks its target
 * by nearest corners, which the group around a tall Sessions ties with. While carried, its place keeps its
 * height as the drop slot. `grow` lets the section that scrolls (Sessions)
 * take the height left while it is open.
 */
export function SidebarSectionItem({
  id,
  label,
  moveLabel,
  moveHint,
  grow = false,
  onStep,
  children,
}: {
  id: string;
  /** The section's name, for the lifted copy and what a screen reader hears. */
  label: string;
  /** The grip's accessible name. */
  moveLabel: string;
  /** What the grip's arrow keys do, for a screen reader. */
  moveHint: string;
  grow?: boolean;
  /** Moves the section one place up (-1) or down (1). */
  onStep: (step: -1 | 1) => void;
  children: ReactNode;
}) {
  const { ref, listeners, style, isDragging } = useSortableItem({
    id,
    data: { type: 'sidebar-section', label },
  });
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    const head = target.closest('[data-slot="sidebar-list-head"]');
    if (!head || !event.currentTarget.contains(head)) return;
    // A heading's own controls keep their press: a menu opens on pointer
    // down, and a drag begun there would drop on the item released over.
    // The fold label acts on click, which a started drag swallows.
    const control = target.closest('button, a, input, [role="button"], [role="combobox"]');
    if (control && head.contains(control) && !control.matches('[data-slot="sidebar-fold-label"]')) {
      return;
    }
    listeners?.onPointerDown?.(event);
  };
  const grip = useRef<HTMLButtonElement>(null);
  const hintId = useId();
  const onGripKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    onStep(event.key === 'ArrowUp' ? -1 : 1);
    // Reordering can move this section's node, and a node removed to be
    // moved loses focus; the grip takes it back once the new order is drawn.
    requestAnimationFrame(() => grip.current?.focus());
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
      <span id={hintId} hidden>
        {moveHint}
      </span>
      <button
        ref={grip}
        type="button"
        aria-label={moveLabel}
        aria-describedby={hintId}
        aria-keyshortcuts="ArrowUp ArrowDown"
        onPointerDown={(event) => listeners?.onPointerDown?.(event)}
        onKeyDown={onGripKeyDown}
        className="absolute top-0 left-px z-10 flex h-(--control-h-sm) w-2.5 cursor-grab items-center justify-center rounded-sm text-fg-subtle opacity-0 outline-none transition-opacity duration-fast group-hover/section:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <GripVertical aria-hidden className="size-3" />
      </button>
      {children}
    </div>
  );
}
