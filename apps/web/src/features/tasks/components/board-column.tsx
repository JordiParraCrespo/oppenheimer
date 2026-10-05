import { cn, IconButton } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import type { TaskStatus } from '@oppenheimer/shared/schemas/task';
import type { DragEvent, ReactNode } from 'react';

/** The column's dot, as the frames draw it: Later hollow, To do grey, In progress amber, Done green. */
const DOT: Record<TaskStatus, string> = {
  later: 'border-[1.5px] border-fg-subtle',
  todo: 'bg-fg-subtle',
  doing: 'bg-warning',
  done: 'bg-success',
};

/**
 * One column of the board: its head (dot, name, count, add) and its tray. The
 * tray takes drops; where in it a card lands is the section's to work out.
 */
export function BoardColumn({
  status,
  name,
  count,
  addLabel,
  over,
  onAdd,
  onDragOver,
  onDrop,
  children,
  footer,
}: {
  status: TaskStatus;
  name: string;
  count: number;
  addLabel: string;
  /** A card is being dragged over this column. */
  over: boolean;
  onAdd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  children: ReactNode;
  /** The inline composer, or the Add task row. */
  footer: ReactNode;
}) {
  return (
    <section aria-label={name} className="flex min-w-0 flex-col gap-2.5">
      <div className="flex h-7 items-center gap-2.25 pr-1 pl-2.5">
        <span className={cn('size-1.75 shrink-0 rounded-pill', DOT[status])} aria-hidden />
        <span className="text-[13.5px] font-medium whitespace-nowrap">{name}</span>
        <span className="figures font-mono text-xs text-fg-subtle">{count}</span>
        <span className="flex-1" />
        <IconButton type="button" size="sm" aria-label={addLabel} onClick={onAdd}>
          <Plus />
        </IconButton>
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target for the pointer; the keyboard moves a card through its dialog's Status row. */}
      <div
        data-col={status}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          'flex min-h-35 flex-col gap-1.5 rounded-lg p-1.5 transition-colors duration-fast',
          over ? 'bg-selected-surface' : 'bg-hover-surface',
        )}
      >
        {children}
        {footer}
      </div>
    </section>
  );
}
