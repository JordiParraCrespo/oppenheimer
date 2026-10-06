'use client';

import {
  type DragItem,
  DragProvider,
  type SortableGroups,
  SortableGroup,
  SortableItem,
  useDraggable,
  useDroppable,
  useSortableGroups,
} from '@oppenheimer/design-system-web/drag';
import { GripVerticalIcon } from '@oppenheimer/design-system-web/icons';
import * as React from 'react';

/* ------------------------------------------------------------------ the drag layer on its own */

const FRUIT = ['Draft the copy', 'Review the PR', 'Book the venue', 'Ship the beta'];

/**
 * The primitives with no product in them: one sortable list, and two bins
 * that take what is dropped on them. The same parts build the board and the
 * calendar below.
 */
export function DragPrimitivesDemo() {
  const [groups, setGroups] = React.useState<SortableGroups>({ list: FRUIT, done: [] });
  const sortable = useSortableGroups(groups, setGroups);
  const [binned, setBinned] = React.useState<string | null>(null);

  return (
    <div className="grid w-full gap-6 lg:grid-cols-2">
      <DragProvider
        {...sortable}
        overlay={(active) => <Row label={active.id} lifted />}
        labels={{ pickedUp: (name) => `Picked up ${name}.` }}
      >
        <div className="grid grid-cols-2 gap-3">
          {(['list', 'done'] as const).map((group) => (
            <div key={group} className="flex flex-col gap-2">
              <span className="eyebrow px-1">{group === 'list' ? 'Sortable list' : 'Another group'}</span>
              <SortableGroup id={group} items={groups[group] ?? []}>
                <div className="flex min-h-40 flex-col gap-1.5 rounded-lg bg-hover-surface p-1.5 transition-colors duration-fast in-data-over:bg-selected-surface">
                  {(groups[group] ?? []).map((id) => (
                    <SortableItem key={id} id={id} data={{ label: id }}>
                      <Row label={id} />
                    </SortableItem>
                  ))}
                </div>
              </SortableGroup>
            </div>
          ))}
        </div>
      </DragProvider>
      <DragProvider
        overlay={(active: DragItem) => <Row label={String(active.data.label ?? active.id)} lifted />}
        onDragEnd={({ active, over }) => setBinned(over ? `${active.data.label} → ${over.data.label}` : null)}
      >
        <div className="flex flex-col gap-3">
          <span className="eyebrow px-1">Draggable · droppable</span>
          <div className="flex gap-2">
            <Token id="a" label="An event" type="event" />
            <Token id="b" label="A task" type="task" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Bin id="any" label="Takes anything" />
            <Bin id="tasks" label="Takes tasks only" accepts={['task']} />
          </div>
          <span className="figures min-h-5 text-xs text-fg-subtle">{binned ?? 'Drop a token on a bin.'}</span>
        </div>
      </DragProvider>
    </div>
  );
}

function Row({ label, lifted }: { label: string; lifted?: boolean }) {
  return (
    <div
      className={
        lifted
          ? 'flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-fg'
          : 'flex h-10 cursor-grab items-center gap-2 rounded-md border border-border-subtle bg-card px-3 text-sm text-fg hover:border-border'
      }
    >
      <GripVerticalIcon className="size-3.5 text-fg-subtle" aria-hidden />
      {label}
    </div>
  );
}

function Token({ id, label, type }: { id: string; label: string; type: string }) {
  const drag = useDraggable({ id, data: { type, label } });
  return (
    <button
      ref={drag.ref}
      type="button"
      {...drag.handleProps}
      className="h-8 touch-none rounded-pill border border-border bg-card px-3 text-sm text-fg data-[dragging=true]:opacity-40"
      data-dragging={drag.isDragging}
    >
      {label}
    </button>
  );
}

function Bin({ id, label, accepts }: { id: string; label: string; accepts?: string[] }) {
  const drop = useDroppable({ id, data: { label }, accepts });
  return (
    <div
      ref={drop.ref}
      data-over={drop.isOver || undefined}
      data-can-drop={drop.canDrop || undefined}
      className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-fg-muted transition-colors duration-fast data-can-drop:border-ring data-over:bg-selected-surface data-over:text-fg"
    >
      {label}
    </div>
  );
}
