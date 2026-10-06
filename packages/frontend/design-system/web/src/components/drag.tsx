'use client';

import {
  type Announcements,
  type Collision,
  type CollisionDetection,
  closestCorners,
  DndContext,
  DragOverlay as DndDragOverlay,
  type DragEndEvent as DndDragEndEvent,
  type DragMoveEvent as DndDragMoveEvent,
  type DragOverEvent as DndDragOverEvent,
  type DragStartEvent as DndDragStartEvent,
  type DropAnimation,
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
import { SortableContext, type SortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
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
 *   The slot follows the pointer the way the frames' board does: it goes
 *   after an item once the pointer passes that item's middle, and it stays
 *   put while the pointer crosses a gap.
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
  /** Past the middle of `over` along its group's axis: the item goes after it, not before. */
  after?: boolean;
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

/** The target the previous move found, and which side of its middle. */
type LastOver = { id: UniqueIdentifier; after: boolean };

type Sorted = { containerId?: UniqueIdentifier; index?: number } | undefined;

function sortedOf(data: Record<string, unknown> | null | undefined): Sorted {
  return data?.sortable as Sorted;
}

/**
 * Only the targets that take the active item, and one of them at most. An
 * item of a sortable group answers with its group's `accepts`, so a group
 * that refuses a type refuses it over its items too, not only over its empty
 * space.
 *
 * Under the pointer, an item wins over the group around it, and in a group's
 * gaps and padding the item nearest the pointer stands in, so the slot never
 * jumps to the group's end and back between two cards. Over nothing, the
 * last target holds. The answer carries `after`: whether the pointer is past
 * the target's middle. From the keyboard, which has no pointer, the nearest
 * corners, and `after` is the direction of travel within a group.
 *
 * One per provider: it remembers the last target, and `reset` forgets it
 * when a drag starts.
 */
function sortableCollisions(): { detect: CollisionDetection; reset: () => void } {
  const last: { current: LastOver | null } = { current: null };
  const detect: CollisionDetection = (args) => {
    const type = args.active.data.current?.type;
    const containerOf = (id: UniqueIdentifier | undefined) => args.droppableContainers.find((c) => c.id === id);
    const accepting = (data: Record<string, unknown> | undefined): boolean => {
      const group = sortedOf(data)?.containerId;
      if (group === undefined) return takes(data?.accepts, type);
      return takes(containerOf(group)?.data.current?.accepts, type);
    };
    const droppableContainers = args.droppableContainers.filter((container) => accepting(container.data.current));
    const answer = (hit: Collision | undefined, after: boolean): Collision[] => {
      last.current = hit ? { id: hit.id, after } : null;
      return hit ? [{ ...hit, data: { ...hit.data, after } }] : [];
    };

    const pointer = args.pointerCoordinates;
    if (!pointer) {
      const hit = closestCorners({ ...args, droppableContainers })[0];
      const from = sortedOf(args.active.data.current);
      const to = sortedOf(containerOf(hit?.id)?.data.current);
      const after =
        from?.containerId !== undefined &&
        from.containerId === to?.containerId &&
        (to.index ?? 0) > (from.index ?? 0);
      return answer(hit, after);
    }

    const under = pointerWithin({ ...args, droppableContainers });
    let hit = under.find((c) => sortedOf(containerOf(c.id)?.data.current) !== undefined) ?? under[0];
    if (!hit) {
      const held = droppableContainers.find((c) => c.id === last.current?.id);
      return held ? [{ id: held.id, data: { droppableContainer: held, after: last.current?.after === true } }] : [];
    }

    const target = containerOf(hit.id);
    if (target?.data.current?.group === true) {
      let nearest: { container: (typeof droppableContainers)[number]; distance: number } | null = null;
      for (const container of droppableContainers) {
        if (sortedOf(container.data.current)?.containerId !== hit.id) continue;
        const rect = args.droppableRects.get(container.id);
        if (!rect) continue;
        const distance = Math.hypot(
          pointer.x - (rect.left + rect.width / 2),
          pointer.y - (rect.top + rect.height / 2),
        );
        if (!nearest || distance < nearest.distance) nearest = { container, distance };
      }
      if (!nearest) return answer(hit, false);
      hit = { id: nearest.container.id, data: { droppableContainer: nearest.container, value: nearest.distance } };
    }

    const rect = args.droppableRects.get(hit.id);
    const group = containerOf(sortedOf(containerOf(hit.id)?.data.current)?.containerId);
    if (!rect || !group) return answer(hit, false);
    const orientation = (group.data.current?.orientation ?? 'vertical') as SortableOrientation;
    const pastX = pointer.x > rect.left + rect.width / 2;
    const pastY = pointer.y > rect.top + rect.height / 2;
    const after =
      orientation === 'horizontal'
        ? pastX
        : orientation === 'vertical'
          ? pastY
          : pointer.y > rect.bottom || (pointer.y >= rect.top && pastX);
    return answer(hit, after);
  };
  return {
    detect,
    reset: () => {
      last.current = null;
    },
  };
}

function afterOf(collisions: Collision[] | null): boolean {
  return collisions?.[0]?.data?.after === true;
}

/**
 * The target the collisions just found. A move event's `over` is the one
 * from before the move (it settles a render later), so read it here.
 */
function hitOf(collisions: Collision[] | null): DragItem | null {
  const container = collisions?.[0]?.data?.droppableContainer as DndEntry | undefined;
  return container ? itemOf(container) : null;
}

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
  const controlInstructions = React.useId();
  const [active, setActive] = React.useState<DragItem | null>(null);
  const [collisions] = React.useState(sortableCollisions);
  // The move last handed to `onDragOver`, so a move that changes neither target nor side says nothing.
  const reported = React.useRef<DragMove | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: ACTIVATION_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * The pointer crossing a target's middle moves the slot as much as reaching
   * a new target does. From the keyboard only a key press moves it: the item
   * stays where the key put it while the layout opens the slot, so a target
   * found by the re-measure that follows is not a move anyone made.
   */
  const report = (event: DndDragMoveEvent | DndDragOverEvent, from: 'move' | 'over') => {
    if (from === 'over' && event.activatorEvent instanceof KeyboardEvent) return;
    const after = afterOf(event.collisions);
    const over = hitOf(event.collisions);
    const previous = reported.current;
    if (previous && previous.over?.id === over?.id && previous.after === after) return;
    const move = { active: itemOf(event.active), over, after };
    reported.current = move;
    onDragOver?.(move);
  };

  const announcements: Announcements = {
    onDragStart: ({ active: a }) => labels.pickedUp(nameOf(a)),
    onDragOver: ({ active: a, over }) => labels.over(nameOf(a), over ? nameOf(over) : null),
    onDragEnd: ({ active: a, over }) => labels.dropped(nameOf(a), over ? nameOf(over) : null),
    onDragCancel: ({ active: a }) => labels.cancelled(nameOf(a)),
  };

  return (
    <ReducedMotion.Provider value={reduced}>
      <ControlInstructions.Provider value={controlInstructions}>
        <DndContext
          sensors={sensors}
          collisionDetection={collisions.detect}
          autoScroll={AUTO_SCROLL}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          accessibility={{ announcements, screenReaderInstructions: { draggable: labels.instructions } }}
          onDragStart={(event: DndDragStartEvent) => {
            const item = itemOf(event.active);
            collisions.reset();
            reported.current = null;
            setActive(item);
            onDragStart?.(item);
          }}
          onDragMove={(event: DndDragMoveEvent) => report(event, 'move')}
          onDragOver={(event: DndDragOverEvent) => report(event, 'over')}
          onDragEnd={(event: DndDragEndEvent) => {
            setActive(null);
            // The drop is the last move the reader saw.
            onDragEnd?.(
              reported.current ?? { active: itemOf(event.active), over: overOf(event.over), after: afterOf(event.collisions) },
            );
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

/**
 * Nothing is displaced by transform: `useSortableGroups` reorders the ids
 * live, so the layout itself opens the slot, and each item that changed
 * place slides from where it was.
 */
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
  const { setNodeRef } = useDndDroppable({ id, data: { ...data, accepts, orientation, group: true } });
  const { active, over } = useDndContext();
  const overGroup =
    over && (String(over.id) === id || over.data.current?.sortable?.containerId === id);
  return (
    <SortableContext id={id} items={items as string[]} strategy={inPlace}>
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
    // Every item that changes place slides there, not only the one being dragged.
    animateLayoutChanges: () => !reduced,
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
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
    data,
    disabled,
    transition: reduced ? null : { duration: SLIDE_MS, easing: EASE_STANDARD },
    animateLayoutChanges: () => !reduced,
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
 * within and between them: the item takes its new place the moment the
 * pointer passes a neighbour's middle or enters another group (so the slot
 * opens there and the neighbours slide), keeps it on drop, and everything
 * goes back on cancel. Spread the handlers on the `DragProvider`;
 * `onChange` gets each new value, and `onMove` the finished move once, for
 * the caller to save.
 *
 * The groups being moved live in a ref for the length of a drag, so an
 * over and the drop that follow each other before a render never read the
 * value from before the item moved.
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

  /** `live` with the item placed by the move, or `live` itself when it is already there. */
  const place = (live: SortableGroups, { active, over, after }: DragMove): SortableGroups => {
    if (!over || over.id === active.id) return live;
    const from = itemGroup(live, active.id);
    const to = targetGroup(live, over);
    if (!from || !to) return live;
    const rest = (live[to] ?? []).filter((id) => id !== active.id);
    let at: number;
    if (over.data.group === true) {
      // Its own group's padding: the nearest item answers for that, so this is the keyboard's edge.
      if (from === to && rest.length > 0) return live;
      at = rest.length;
    } else {
      const overIndex = rest.indexOf(over.id);
      if (overIndex === -1) return live;
      at = overIndex + (after ? 1 : 0);
    }
    if (from === to && (live[to] ?? []).indexOf(active.id) === at) return live;
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
    onDragOver: (move: DragMove) => {
      const current = drag.current;
      if (!current) return;
      const next = place(current.live, move);
      if (next === current.live) return;
      current.live = next;
      onChange(next);
    },
    onDragEnd: (move: DragMove) => {
      const current = drag.current;
      drag.current = null;
      if (!current) return;
      const { start, from } = current;
      if (!move.over) {
        onChange(start);
        return;
      }
      const next = place(current.live, move);
      const to = itemGroup(next, move.active.id);
      if (!to) {
        onChange(start);
        return;
      }
      if (next !== value) onChange(next);
      const index = (next[to] ?? []).indexOf(move.active.id);
      if (to !== from || index !== (start[from] ?? []).indexOf(move.active.id)) {
        onMove?.({ id: move.active.id, from, to, index });
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
  useSortableControl,
  useSortableGroups,
  useSortableItem,
};
export type { DragData, DragItem, DragLabels, DragMove, SortableGroups, SortableOrientation };
