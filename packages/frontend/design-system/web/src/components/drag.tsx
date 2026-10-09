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
  type DroppableContainer,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  type UniqueIdentifier,
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
  type SortingStrategy,
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
 *   A `live` provider (a board) reorders within a group live too, the way
 *   the frames' board does: the slot goes after an item once the pointer
 *   passes that item's middle, and the layout itself opens it.
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
  /** For an item that is also a link or a button (`useSortableControl`): Space picks it up, Enter opens it. */
  controlInstructions: string;
  pickedUp: (name: string) => string;
  over: (name: string, target: string | null) => string;
  dropped: (name: string, target: string | null) => string;
  cancelled: (name: string) => string;
}

const DEFAULT_LABELS: DragLabels = {
  instructions:
    'To pick up an item, press space or enter. Use the arrow keys to move it, space or enter to drop it, and escape to cancel.',
  controlInstructions:
    'To pick up an item, press space; enter opens it. Use the arrow keys to move it, space or enter to drop it, and escape to cancel.',
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
/** Inside a `live` provider: groups keep their layout and the ids reorder as the item moves. */
const LiveOrder = React.createContext(false);
/** The id of the provider's `controlInstructions`, which a control's description points at. */
const ControlInstructions = React.createContext<string | undefined>(undefined);

/**
 * The drop slot: while an item is the one being dragged, its place keeps its
 * size, its content invisible on the selected wash with the ring inside.
 * `SortableItem` and `useSortableControl`'s node both wear it.
 */
const SORTABLE_SLOT =
  'touch-none data-dragging:bg-selected-surface data-dragging:shadow-[inset_0_0_0_1px_var(--ring)] data-dragging:[&>*]:invisible';

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

type Sorted = { containerId?: UniqueIdentifier; index?: number; items?: UniqueIdentifier[] } | undefined;

function sortedOf(container: DroppableContainer | undefined): Sorted {
  return container?.data.current?.sortable as Sorted;
}

/**
 * Only the targets that take the active item. An item of a sortable group
 * answers with its group's `accepts`, so a group that refuses a type
 * refuses it over its items too, not only over its empty space.
 */
function acceptingTargets(args: Parameters<CollisionDetection>[0]) {
  const type = args.active.data.current?.type;
  const accepting = (container: DroppableContainer): boolean => {
    const group = sortedOf(container)?.containerId;
    if (group === undefined) return takes(container.data.current?.accepts, type);
    return takes(args.droppableContainers.find((c) => c.id === group)?.data.current?.accepts, type);
  };
  return { ...args, droppableContainers: args.droppableContainers.filter(accepting) };
}

/** Under the pointer first; from the keyboard, which has no pointer, the nearest corners. */
const acceptingCollisions: CollisionDetection = (args) => {
  const scoped = acceptingTargets(args);
  const under = pointerWithin(scoped);
  return under.length > 0 ? under : closestCorners(scoped);
};

/**
 * A `live` provider's answer: not the target under the item but its slot,
 * named by what it goes before — an item, or the group itself for its end.
 * Under the pointer an item wins over the group around it, and in a group's
 * gaps and padding the nearest item answers, so the slot never runs to the
 * end and back between two cards; past an item's middle the slot is the
 * next one's. Over nothing it is nothing, and the slot stays where it was.
 * From the keyboard, the nearest corners, and the slot is past the item
 * when the keys moved toward it.
 */
const slotCollisions: CollisionDetection = (args) => {
  const scoped = acceptingTargets(args);
  const containerOf = (id: UniqueIdentifier | undefined) => scoped.droppableContainers.find((c) => c.id === id);
  const answer = (container: DroppableContainer | undefined) =>
    container ? [{ id: container.id, data: { droppableContainer: container } }] : [];
  /** `item`'s slot, or the one after it: the next item but the active one, else the group's end. */
  const slot = (item: DroppableContainer, after: boolean) => {
    const sorted = sortedOf(item);
    // Over its own slot the item is where it goes, whichever half the pointer is in.
    if (!after || !sorted || item.id === args.active.id) return answer(item);
    const rest = (sorted.items ?? []).filter((id) => id !== args.active.id);
    const next = rest[rest.indexOf(item.id) + 1];
    return answer(next === undefined ? containerOf(sorted.containerId) : containerOf(next));
  };

  const pointer = args.pointerCoordinates;
  if (!pointer) {
    const hit = containerOf(closestCorners(scoped)[0]?.id);
    const from = sortedOf(containerOf(args.active.id));
    if (!hit) return [];
    // Its own group's corner is the keyboard at an edge, not a move to the end.
    if (hit.data.current?.group === true && hit.id === from?.containerId) return answer(containerOf(args.active.id));
    const to = sortedOf(hit);
    return slot(hit, to?.containerId === from?.containerId && (to?.index ?? 0) > (from?.index ?? 0));
  }

  const under = pointerWithin(scoped);
  let hit = containerOf(under.find((c) => sortedOf(containerOf(c.id)) !== undefined)?.id) ?? containerOf(under[0]?.id);
  if (hit?.data.current?.group === true) {
    let nearest: { item: DroppableContainer; distance: number } | null = null;
    for (const item of scoped.droppableContainers) {
      if (sortedOf(item)?.containerId !== hit.id) continue;
      const rect = scoped.droppableRects.get(item.id);
      if (!rect) continue;
      const distance = Math.hypot(pointer.x - (rect.left + rect.width / 2), pointer.y - (rect.top + rect.height / 2));
      if (!nearest || distance < nearest.distance) nearest = { item, distance };
    }
    if (!nearest) return answer(hit);
    hit = nearest.item;
  }
  const rect = hit ? scoped.droppableRects.get(hit.id) : undefined;
  if (!hit || !rect) return answer(hit);
  const orientation = containerOf(sortedOf(hit)?.containerId)?.data.current?.orientation as SortableOrientation;
  const pastX = pointer.x > rect.left + rect.width / 2;
  const pastY = pointer.y > rect.top + rect.height / 2;
  const after =
    orientation === 'horizontal'
      ? pastX
      : orientation === 'grid'
        ? pointer.y > rect.bottom || (pointer.y >= rect.top && pastX)
        : pastY;
  return slot(hit, after);
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
 * The keys under a `live` provider: the same steps, from the item's own
 * place. dnd-kit's getter skips the target `over` names, which here is the
 * slot's next item, not the one the keys reached, so it would jump two.
 */
const slotKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) =>
  sortableKeyboardCoordinates(event, { ...args, context: { ...args.context, over: null } });

/**
 * One surface's drag. `overlay` draws the lifted copy for the active item;
 * without it nothing follows the pointer, which suits a target-only surface
 * that shows the move another way.
 *
 * `live` is for a surface whose groups are all ordered by
 * `useSortableGroups` with `{ live: true }` (a board): its groups keep their
 * layout while the ids reorder, every item that changes place slides there,
 * and `over` names the slot (`slotCollisions`) rather than the target.
 */
function DragProvider({
  live = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
  overlay,
  labels: labelsProp,
  children,
}: {
  live?: boolean;
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
  const controlInstructions = React.useId();
  const [active, setActive] = React.useState<DragItem | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: ACTIVATION_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: live ? slotKeyboardCoordinates : sortableKeyboardCoordinates }),
  );

  const announcements: Announcements = {
    onDragStart: ({ active: a }) => labels.pickedUp(nameOf(a)),
    onDragOver: ({ active: a, over }) => labels.over(nameOf(a), over ? nameOf(over) : null),
    onDragEnd: ({ active: a, over }) => labels.dropped(nameOf(a), over ? nameOf(over) : null),
    onDragCancel: ({ active: a }) => labels.cancelled(nameOf(a)),
  };

  return (
    <ReducedMotion.Provider value={reduced}>
      <LiveOrder.Provider value={live}>
        <ControlInstructions.Provider value={controlInstructions}>
          <DndContext
            sensors={sensors}
            collisionDetection={live ? slotCollisions : acceptingCollisions}
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
          <span id={controlInstructions} hidden>
            {labels.controlInstructions}
          </span>
        </ControlInstructions.Provider>
      </LiveOrder.Provider>
    </ReducedMotion.Provider>
  );
}

/**
 * The lifted copy: tilted, a touch larger, on the popover shadow. A rail
 * item is round, so its lift is a pill on the card surface rather than the
 * card-shaped box.
 */
function DragLift({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-slot="drag-lift"
      className="cursor-grabbing rounded-md shadow-popover motion-safe:animate-drag-lift has-[>[data-slot=rail-item]]:rounded-pill has-[>[data-slot=rail-item]]:bg-card"
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

/** Inside a `live` provider nothing is displaced by transform: the layout opens the slot. */
const inPlace: SortingStrategy = () => null;

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
  const live = React.useContext(LiveOrder);
  const { setNodeRef } = useDndDroppable({ id, data: { ...data, accepts, orientation, group: true } });
  const { active, over } = useDndContext();
  const overGroup =
    over && (String(over.id) === id || over.data.current?.sortable?.containerId === id);
  return (
    <SortableContext id={id} items={items as string[]} strategy={live ? inPlace : STRATEGY[orientation]}>
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
 * Inside a `live` provider no strategy displaces the neighbours, so every
 * item whose place changes slides there from where it was; dnd-kit's
 * default animates only the item that was dragged.
 */
function slideOnReorder(live: boolean) {
  return live ? { animateLayoutChanges: () => true } : {};
}

/**
 * One item of a `SortableGroup`. Returns the ref, the handle's props, and
 * the style that slides it while its neighbours move.
 */
function useSortableItem({ id, data, disabled }: { id: string; data?: DragData; disabled?: boolean }) {
  const reduced = React.useContext(ReducedMotion);
  const live = React.useContext(LiveOrder);
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
    data,
    disabled,
    transition: reduced ? null : { duration: SLIDE_MS, easing: EASE_STANDARD },
    ...slideOnReorder(live),
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
        'relative outline-none select-none focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-ring data-dragging:rounded-md',
        SORTABLE_SLOT,
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
 * A sortable item that is also a link or a button: a sidebar row, a rail
 * item. Enter keeps opening it and Space picks it up, so the two never
 * meet; the screen reader is told so, and the control keeps its own role
 * and is never announced as disabled. Returns two prop sets:
 *
 * - `node`: the box that is measured, moves and takes the pointer (the row,
 *   with the drop slot's look); a key pressed on the control inside bubbles
 *   to it.
 * - `control`: the link or button the reader focuses; only it starts a drag
 *   from the keyboard, so a field inside it never does.
 *
 * When the control is the whole item (a rail item), spread both on it and
 * pass both refs.
 */
function useSortableControl({ id, data, disabled }: { id: string; data?: DragData; disabled?: boolean }) {
  const reduced = React.useContext(ReducedMotion);
  const instructions = React.useContext(ControlInstructions);
  const live = React.useContext(LiveOrder);
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
    data,
    disabled,
    transition: reduced ? null : { duration: SLIDE_MS, easing: EASE_STANDARD },
    ...slideOnReorder(live),
  });
  return {
    isDragging,
    node: {
      ref: setNodeRef,
      style: { transform: CSS.Translate.toString(transform), transition } as React.CSSProperties,
      'data-dragging': isDragging || undefined,
      className: SORTABLE_SLOT,
      onPointerDown: (event: React.PointerEvent) => listeners?.onPointerDown?.(event),
      // Enter is the control's own: it opens the session or the page.
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key !== 'Enter') listeners?.onKeyDown?.(event);
      },
    },
    control: {
      ref: setActivatorNodeRef,
      'aria-roledescription': attributes['aria-roledescription'],
      'aria-describedby': instructions,
    },
  };
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
 * the `DragProvider`; `onChange` gets each new value, with `settled` on the
 * last one of a drag (the drop's, or the start again on a cancel), so a
 * caller that draws the live value while dragging knows when to stop; and
 * `onMove` the finished move once with the value it settled on, for the
 * caller to save.
 *
 * With `{ live: true }`, under a `live` provider, `over` is the slot (what
 * the item goes before, or a group for its end) and the item takes it the
 * moment it changes, within a group as across; over nothing it keeps its
 * place, and a drop there leaves it in the last one it took.
 *
 * The groups being moved live in a ref for the length of a drag, so an
 * over and the drop that follow each other before a render never read the
 * value from before the item crossed.
 */
function useSortableGroups(
  value: SortableGroups,
  onChange: (next: SortableGroups, change: { settled: boolean }) => void,
  onMove?: (move: { id: string; from: string; to: string; index: number }, next: SortableGroups) => void,
  { live: liveOrder = false }: { live?: boolean } = {},
) {
  const drag = React.useRef<{ start: SortableGroups; from: string; live: SortableGroups } | null>(null);

  const itemGroup = (groups: SortableGroups, id: string) =>
    Object.keys(groups).find((key) => groups[key]?.includes(id));
  // A group stamps `group: true` on its data; anything else is an item, whatever its id.
  const targetGroup = (groups: SortableGroups, over: DragItem) =>
    over.data.group === true ? over.id : itemGroup(groups, over.id);

  const publish = (next: SortableGroups) => {
    if (drag.current) drag.current.live = next;
    onChange(next, { settled: false });
  };

  /** `live` with the item in the slot `over` names, or `live` itself when it is already there. */
  const intoSlot = (live: SortableGroups, active: DragItem, over: DragItem): SortableGroups => {
    if (over.id === active.id) return live;
    const from = itemGroup(live, active.id);
    const to = targetGroup(live, over);
    if (!from || !to) return live;
    const rest = (live[to] ?? []).filter((id) => id !== active.id);
    const at = over.data.group === true ? rest.length : rest.indexOf(over.id);
    if (at === -1 || (from === to && live[to]?.indexOf(active.id) === at)) return live;
    return {
      ...live,
      [from]: (live[from] ?? []).filter((id) => id !== active.id),
      [to]: [...rest.slice(0, at), active.id, ...rest.slice(at)],
    };
  };

  return {
    onDragStart: (active: DragItem) => {
      const from = itemGroup(value, active.id);
      drag.current = from ? { start: value, from, live: value } : null;
    },
    onDragOver: ({ active, over }: DragMove) => {
      const live = drag.current?.live;
      if (!live || !over) return;
      if (liveOrder) {
        const next = intoSlot(live, active, over);
        if (next !== live) publish(next);
        return;
      }
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
      let next: SortableGroups;
      if (liveOrder) {
        next = over ? intoSlot(live, active, over) : live;
      } else {
        const to = itemGroup(live, active.id);
        if (!over || !to) {
          onChange(start, { settled: true });
          return;
        }
        const list = live[to] ?? [];
        const at = list.indexOf(active.id);
        const overIndex = over.data.group === true ? -1 : list.indexOf(over.id);
        next = overIndex !== -1 && overIndex !== at ? { ...live, [to]: arrayMove([...list], at, overIndex) } : live;
      }
      const to = itemGroup(next, active.id);
      if (!to) {
        onChange(start, { settled: true });
        return;
      }
      onChange(next, { settled: true });
      const index = (next[to] ?? []).indexOf(active.id);
      if (to !== from || index !== (start[from] ?? []).indexOf(active.id)) {
        onMove?.({ id: active.id, from, to, index }, next);
      }
    },
    onDragCancel: () => {
      const current = drag.current;
      drag.current = null;
      if (current) onChange(current.start, { settled: true });
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
  useSortableControl,
  useSortableGroups,
  useSortableItem,
};
export type { DragData, DragItem, DragLabels, DragMove, SortableGroups, SortableOrientation };
