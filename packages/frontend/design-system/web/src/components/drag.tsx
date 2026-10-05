'use client';

import {
  type Announcements,
  type CollisionDetection,
  closestCorners,
  DndContext,
  DragOverlay as DndDragOverlay,
  type DragEndEvent as DndDragEndEvent,
  type DragOverEvent as DndDragOverEvent,
  type DragStartEvent as DndDragStartEvent,
  type DropAnimation,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDndContext,
  useDraggable as useDndDraggable,
  useDroppable as useDndDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * The drag layer — headless primitives any surface composes to move things
 * by dragging: cards between a board's columns, entries onto a calendar's
 * days, later a session onto a project. They move ids and `data`, never a
 * product's records; what a drop means is the caller's `onDragEnd`.
 *
 * - `DragProvider` owns one surface's drag: pointer and keyboard input, Esc,
 *   scrolling at the edges, the lifted copy and what a screen reader hears.
 * - `useDraggable` / `useDroppable` make anything a source or a target;
 *   `accepts` on a target names the `data.type`s it takes.
 * - `SortableGroup` / `SortableItem` keep things in order in one or more
 *   groups: the item's own slot becomes the drop slot, its neighbours slide
 *   out of the way, and `useSortableGroups` moves ids between groups live.
 *
 * The motion is the frames' on the system's ramp: a drag starts after 5px
 * (so a click still opens the thing), the lifted copy takes `--drag-lift`
 * and the popover shadow over the fast duration, neighbours slide on the
 * base duration, and the copy glides into its slot on the same while the
 * lift and shadow settle. Under reduced motion the copy neither lifts nor
 * glides and nothing slides.
 *
 * Files dragged in from the desktop are not this layer's: that is `DropZone`.
 */

type DragData = { type?: string; label?: string; accepts?: readonly string[] } & Record<string, unknown>;

interface DragItem {
  id: string;
  data: DragData;
}

interface DragMove {
  active: DragItem;
  /** The target under the item, or `null` over nothing that takes it. */
  over: DragItem | null;
}

/** What a screen reader hears; `name` is the item's `data.label`, else its id. */
interface DragLabels {
  instructions: string;
  pickedUp: (name: string) => string;
  over: (name: string, target: string | null) => string;
  dropped: (name: string, target: string | null) => string;
  cancelled: (name: string) => string;
}

const DEFAULT_LABELS: DragLabels = {
  instructions:
    'To pick up an item, press space or enter. Use the arrow keys to move it, space or enter to drop it, and escape to cancel.',
  pickedUp: (name) => `Picked up ${name}.`,
  over: (name, target) => (target ? `${name} is over ${target}.` : `${name} is not over a place it can go.`),
  dropped: (name, target) => (target ? `${name} was dropped on ${target}.` : `${name} was dropped.`),
  cancelled: (name) => `Moving ${name} was cancelled.`,
};

const EASE_STANDARD = 'cubic-bezier(0.4, 0, 0.2, 1)';
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** Neighbours making room, and the lifted copy into its slot: `--dur-base`. */
const SLIDE_MS = 220;
const DROP_MS = SLIDE_MS;
/** Movement before a press becomes a drag. */
const ACTIVATION_PX = 5;
/**
 * Scrolling while the pointer nears an edge: only the outer 8% of the
 * scroller, and gently, so holding an item over a target near the bottom of
 * the window does not run the page away from it.
 */
const AUTO_SCROLL = { threshold: { x: 0.08, y: 0.08 }, acceleration: 4 } as const;

const ReducedMotion = React.createContext(false);

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    // The OS setting, so the drag honours it the way the tokens do.
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

type DndEntry = { id: string | number; data: { current?: Record<string, unknown> | null } };

function itemOf(entry: DndEntry): DragItem {
  return { id: String(entry.id), data: (entry.data.current ?? {}) as DragData };
}

function overOf(entry: DndEntry | null): DragItem | null {
  return entry ? itemOf(entry) : null;
}

function nameOf(entry: DndEntry | null): string {
  const label = entry?.data.current?.label;
  return typeof label === 'string' ? label : String(entry?.id ?? '');
}

/** Whether a target takes an item: a target without `accepts` takes anything. */
function takes(accepts: unknown, type: unknown): boolean {
  return !Array.isArray(accepts) || (typeof type === 'string' && accepts.includes(type));
}

/**
 * Only the targets that take the active item. Under the pointer first; from
 * the keyboard, which has no pointer, the nearest corners.
 */
const acceptingCollisions: CollisionDetection = (args) => {
  const type = args.active.data.current?.type;
  const droppableContainers = args.droppableContainers.filter((container) =>
    takes(container.data.current?.accepts, type),
  );
  const scoped = { ...args, droppableContainers };
  const under = pointerWithin(scoped);
  return under.length > 0 ? under : closestCorners(scoped);
};

/** Settles the lift while the copy glides home, so it lands flat. */
function dropAnimation(reduced: boolean): DropAnimation | null {
  if (reduced) return null;
  return {
    duration: DROP_MS,
    easing: EASE_OUT,
    sideEffects: ({ dragOverlay }) => {
      const lift = dragOverlay.node.querySelector<HTMLElement>('[data-slot="drag-lift"]');
      if (!lift) return;
      lift.style.animation = 'none';
      lift.style.transition = `transform ${DROP_MS}ms ${EASE_OUT}, box-shadow ${DROP_MS}ms ${EASE_OUT}`;
      lift.style.transform = 'none';
      lift.style.boxShadow = 'none';
    },
  };
}

/**
 * One surface's drag. `overlay` draws the lifted copy for the active item;
 * without it nothing follows the pointer, which suits a target-only surface
 * that shows the move another way.
 */
function DragProvider({
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
  overlay,
  labels: labelsProp,
  children,
}: {
  onDragStart?: (active: DragItem) => void;
  onDragOver?: (move: DragMove) => void;
  onDragEnd?: (move: DragMove) => void;
  onDragCancel?: (active: DragItem) => void;
  overlay?: (active: DragItem) => React.ReactNode;
  labels?: Partial<DragLabels>;
  children: React.ReactNode;
}) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = React.useState<DragItem | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: ACTIVATION_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const announcements: Announcements = {
    onDragStart: ({ active: a }) => labels.pickedUp(nameOf(a)),
    onDragOver: ({ active: a, over }) => labels.over(nameOf(a), over ? nameOf(over) : null),
    onDragEnd: ({ active: a, over }) => labels.dropped(nameOf(a), over ? nameOf(over) : null),
    onDragCancel: ({ active: a }) => labels.cancelled(nameOf(a)),
  };

  return (
    <ReducedMotion.Provider value={reduced}>
      <DndContext
        sensors={sensors}
        collisionDetection={acceptingCollisions}
        autoScroll={AUTO_SCROLL}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        accessibility={{ announcements, screenReaderInstructions: { draggable: labels.instructions } }}
        onDragStart={(event: DndDragStartEvent) => {
          const item = itemOf(event.active);
          setActive(item);
          onDragStart?.(item);
        }}
        onDragOver={(event: DndDragOverEvent) => {
          onDragOver?.({ active: itemOf(event.active), over: overOf(event.over) });
        }}
        onDragEnd={(event: DndDragEndEvent) => {
          setActive(null);
          onDragEnd?.({ active: itemOf(event.active), over: overOf(event.over) });
        }}
        onDragCancel={(event) => {
          setActive(null);
          onDragCancel?.(itemOf(event.active));
        }}
      >
        {children}
        {overlay ? (
          <DndDragOverlay dropAnimation={dropAnimation(reduced)}>
            {active ? <DragLift>{overlay(active)}</DragLift> : null}
          </DndDragOverlay>
        ) : null}
      </DndContext>
    </ReducedMotion.Provider>
  );
}

/** The lifted copy: tilted, a touch larger, on the popover shadow. */
function DragLift({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-slot="drag-lift"
      className="cursor-grabbing rounded-md shadow-popover motion-safe:animate-drag-lift"
    >
      {children}
    </div>
  );
}

/**
 * Where a dragged item will land: the selected wash with a hairline ring.
 * `SortableItem` draws it in the item's own place; a surface that keeps a
 * separate placeholder draws it at the size it needs.
 */
function DropSlot({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      data-slot="drop-slot"
      className={cn('rounded-md bg-selected-surface shadow-[inset_0_0_0_1px_var(--ring)]', className)}
      {...props}
    />
  );
}

/** A drag source. Spread `handleProps` on what is pressed to pick it up. */
function useDraggable({ id, data, disabled }: { id: string; data?: DragData; disabled?: boolean }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDndDraggable({ id, data, disabled });
  return { ref: setNodeRef, handleProps: { ...attributes, ...listeners }, isDragging };
}

/**
 * A drop target. `isOver` while an item it takes is over it; `canDrop`
 * while any item it takes is being dragged, so a surface can show where
 * things may go.
 */
function useDroppable({
  id,
  data,
  accepts,
  disabled,
}: {
  id: string;
  data?: DragData;
  accepts?: readonly string[];
  disabled?: boolean;
}) {
  const { setNodeRef, isOver, active } = useDndDroppable({ id, data: { ...data, accepts }, disabled });
  const canDrop = active !== null && takes(accepts, active.data.current?.type);
  // Collision detection never reports a target that refuses the item, so `isOver` already implies it takes it.
  return { ref: setNodeRef, isOver, canDrop };
}

type SortableOrientation = 'vertical' | 'horizontal' | 'grid';

const STRATEGY = {
  vertical: verticalListSortingStrategy,
  horizontal: horizontalListSortingStrategy,
  grid: rectSortingStrategy,
} as const;

/**
 * An ordered group: a board column, a list. It is also a target, so an
 * empty group still takes an item. `data-over` is set while the active item
 * would land in it, for the surface's tint.
 */
function SortableGroup({
  id,
  items,
  orientation = 'vertical',
  accepts,
  data,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'id'> & {
  id: string;
  /** The ids in this group, in order. */
  items: readonly string[];
  orientation?: SortableOrientation;
  accepts?: readonly string[];
  data?: DragData;
}) {
  const { setNodeRef } = useDndDroppable({ id, data: { ...data, accepts, group: true } });
  const { active, over } = useDndContext();
  const overGroup =
    over && (String(over.id) === id || over.data.current?.sortable?.containerId === id);
  return (
    <SortableContext id={id} items={items as string[]} strategy={STRATEGY[orientation]}>
      <div
        ref={setNodeRef}
        data-slot="sortable-group"
        data-over={(active && overGroup) || undefined}
        className={className}
        {...props}
      >
        {children}
      </div>
    </SortableContext>
  );
}

/**
 * One item of a `SortableGroup`. Returns the ref, the handle's props, and
 * the style that slides it while its neighbours move.
 */
function useSortableItem({ id, data, disabled }: { id: string; data?: DragData; disabled?: boolean }) {
  const reduced = React.useContext(ReducedMotion);
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
    data,
    disabled,
    transition: reduced ? null : { duration: SLIDE_MS, easing: EASE_STANDARD },
  });
  return {
    ref: setNodeRef,
    handleProps: { ...attributes, ...listeners },
    style: { transform: CSS.Translate.toString(transform), transition } as React.CSSProperties,
    isDragging,
  };
}

/**
 * The item as a box: the whole box is the handle (for a grip instead, use
 * `useSortableItem` and spread its props on the grip). While it is the one
 * being dragged its place becomes the drop slot, at its exact size: the
 * content stays laid out, invisible, on the slot's wash.
 */
function SortableItem({
  id,
  data,
  disabled,
  className,
  style,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'id'> & { id: string; data?: DragData; disabled?: boolean }) {
  const { ref, handleProps, style: slide, isDragging } = useSortableItem({ id, data, disabled });
  return (
    <div
      ref={ref}
      data-slot="sortable-item"
      data-dragging={isDragging || undefined}
      style={{ ...style, ...slide }}
      className={cn(
        'relative touch-none outline-none select-none focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-ring',
        'data-dragging:rounded-md data-dragging:bg-selected-surface data-dragging:shadow-[inset_0_0_0_1px_var(--ring)] data-dragging:[&>*]:invisible',
        className,
      )}
      {...handleProps}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Spread on a control inside a draggable (a checkbox, a menu button) so
 * pressing it, or Space and Enter on it, never picks the item up.
 */
const dragIgnore = {
  onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
  onKeyDown: (event: React.KeyboardEvent) => event.stopPropagation(),
};

type SortableGroups = Record<string, readonly string[]>;

/**
 * Keeps several `SortableGroup`s' ids as one value while things move
 * between them: an item crosses into another group the moment it is over
 * it (so the slot opens there and the neighbours slide), takes its final
 * place on drop, and everything goes back on cancel. Spread the handlers on
 * the `DragProvider`; `onChange` gets each new value, and `onMove` the
 * finished move once, for the caller to save.
 *
 * The groups being moved live in a ref for the length of a drag, so an
 * over and the drop that follow each other before a render never read the
 * value from before the item crossed.
 */
function useSortableGroups(
  value: SortableGroups,
  onChange: (next: SortableGroups) => void,
  onMove?: (move: { id: string; from: string; to: string; index: number }) => void,
) {
  const drag = React.useRef<{ start: SortableGroups; from: string; live: SortableGroups } | null>(null);

  const itemGroup = (groups: SortableGroups, id: string) =>
    Object.keys(groups).find((key) => groups[key]?.includes(id));
  // A group stamps `group: true` on its data; anything else is an item, whatever its id.
  const targetGroup = (groups: SortableGroups, over: DragItem) =>
    over.data.group === true ? over.id : itemGroup(groups, over.id);

  const publish = (next: SortableGroups) => {
    if (drag.current) drag.current.live = next;
    onChange(next);
  };

  return {
    onDragStart: (active: DragItem) => {
      const from = itemGroup(value, active.id);
      drag.current = from ? { start: value, from, live: value } : null;
    },
    onDragOver: ({ active, over }: DragMove) => {
      const live = drag.current?.live;
      if (!live || !over) return;
      const from = itemGroup(live, active.id);
      const to = targetGroup(live, over);
      if (!from || !to || from === to) return;
      const target = live[to] ?? [];
      const overIndex = over.data.group === true ? -1 : target.indexOf(over.id);
      const index = overIndex === -1 ? target.length : overIndex;
      publish({
        ...live,
        [from]: (live[from] ?? []).filter((id) => id !== active.id),
        [to]: [...target.slice(0, index), active.id, ...target.slice(index)],
      });
    },
    onDragEnd: ({ active, over }: DragMove) => {
      const current = drag.current;
      drag.current = null;
      if (!current) return;
      const { start, from, live } = current;
      const to = itemGroup(live, active.id);
      if (!over || !to) {
        onChange(start);
        return;
      }
      const list = live[to] ?? [];
      const at = list.indexOf(active.id);
      const overIndex = over.data.group === true ? -1 : list.indexOf(over.id);
      const next = overIndex !== -1 && overIndex !== at ? { ...live, [to]: arrayMove([...list], at, overIndex) } : live;
      if (next !== value) onChange(next);
      const index = (next[to] ?? []).indexOf(active.id);
      if (to !== from || index !== (start[from] ?? []).indexOf(active.id)) {
        onMove?.({ id: active.id, from, to, index });
      }
    },
    onDragCancel: () => {
      const current = drag.current;
      drag.current = null;
      if (current) onChange(current.start);
    },
  };
}

export {
  DragProvider,
  dragIgnore,
  DropSlot,
  SortableGroup,
  SortableItem,
  useDraggable,
  useDroppable,
  useSortableGroups,
  useSortableItem,
};
export type { DragData, DragItem, DragLabels, DragMove, SortableGroups, SortableOrientation };
