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
 * The motion is the frames': a drag starts after 5px (so a click still opens
 * the thing), the lifted copy tilts 1.6° and grows 2.5% with the popover
 * shadow, neighbours slide on 220ms, and the copy glides into its slot on
 * 200ms while the tilt and shadow settle. Under reduced motion the copy
 * neither tilts nor glides and nothing slides.
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
/** Neighbours making room. */
const SLIDE_MS = 220;
/** The lifted copy into its slot. */
const DROP_MS = 200;
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

function itemOf(entry: { id: string | number; data: { current?: Record<string, unknown> | null } } | null): DragItem | null {
  if (!entry) return null;
  return { id: String(entry.id), data: (entry.data.current ?? {}) as DragData };
}

function nameOf(entry: { id: string | number; data: { current?: Record<string, unknown> | null } } | null): string {
  const label = entry?.data.current?.label;
  return typeof label === 'string' ? label : String(entry?.id ?? '');
}

/**
 * Only the targets that take the active item: a target without `accepts`
 * takes anything. Under the pointer first; from the keyboard, which has no
 * pointer, the nearest corners.
 */
const acceptingCollisions: CollisionDetection = (args) => {
  const type = args.active.data.current?.type;
  const droppableContainers = args.droppableContainers.filter((container) => {
    const accepts = container.data.current?.accepts as readonly string[] | undefined;
    return !accepts || (typeof type === 'string' && accepts.includes(type));
  });
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
          const item = itemOf(event.active) as DragItem;
          setActive(item);
          onDragStart?.(item);
        }}
        onDragOver={(event: DndDragOverEvent) => {
          onDragOver?.({ active: itemOf(event.active) as DragItem, over: itemOf(event.over) });
        }}
        onDragEnd={(event: DndDragEndEvent) => {
          setActive(null);
          onDragEnd?.({ active: itemOf(event.active) as DragItem, over: itemOf(event.over) });
        }}
        onDragCancel={(event) => {
          setActive(null);
          onDragCancel?.(itemOf(event.active) as DragItem);
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
  const type = active?.data.current?.type;
  const takes = !accepts || (typeof type === 'string' && accepts.includes(type));
  return { ref: setNodeRef, isOver: isOver && takes, canDrop: active !== null && takes };
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
 * The item as a box: the whole box is the handle (`handle={false}` leaves
 * the caller to spread `useSortableItem`'s props on a grip instead). While
 * it is the one being dragged its place becomes the drop slot, at its exact
 * size: the content stays laid out, invisible, on the slot's wash.
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
 */
function useSortableGroups(
  value: SortableGroups,
  onChange: (next: SortableGroups) => void,
  onMove?: (move: { id: string; from: string; to: string; index: number }) => void,
) {
  const snapshot = React.useRef<{ value: SortableGroups; from: string } | null>(null);

  const groupOf = (groups: SortableGroups, id: string): string | undefined =>
    id in groups ? id : Object.keys(groups).find((key) => groups[key]?.includes(id));

  return {
    onDragStart: (active: DragItem) => {
      const from = groupOf(value, active.id);
      snapshot.current = from ? { value, from } : null;
    },
    onDragOver: ({ active, over }: DragMove) => {
      if (!over) return;
      const from = groupOf(value, active.id);
      const to = groupOf(value, over.id);
      if (!from || !to || from === to) return;
      const source = value[from] ?? [];
      const target = value[to] ?? [];
      const overIndex = target.indexOf(over.id);
      const index = overIndex === -1 ? target.length : overIndex;
      onChange({
        ...value,
        [from]: source.filter((id) => id !== active.id),
        [to]: [...target.slice(0, index), active.id, ...target.slice(index)],
      });
    },
    onDragEnd: ({ active, over }: DragMove) => {
      const start = snapshot.current;
      snapshot.current = null;
      const to = groupOf(value, active.id);
      if (!over || !to || !start) {
        if (start) onChange(start.value);
        return;
      }
      const list = value[to] ?? [];
      const from = list.indexOf(active.id);
      const overIndex = list.indexOf(over.id);
      const next =
        overIndex !== -1 && overIndex !== from ? { ...value, [to]: arrayMove([...list], from, overIndex) } : value;
      if (next !== value) onChange(next);
      const index = (next[to] ?? []).indexOf(active.id);
      const original = start.value[start.from] ?? [];
      if (to !== start.from || index !== original.indexOf(active.id)) {
        onMove?.({ id: active.id, from: start.from, to, index });
      }
    },
    onDragCancel: () => {
      const start = snapshot.current;
      snapshot.current = null;
      if (start) onChange(start.value);
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
