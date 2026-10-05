import { cn } from '@oppenheimer/design-system-web';
import type { CalendarLayer } from '../lib/calendar-search';

/** Each layer's mark, the same in the sidebar's toggles and on the grid. */
export const LAYER_TONE: Record<CalendarLayer, string> = {
  events: 'bg-primary',
  google: 'bg-info',
  tasks: 'bg-warning',
  automations: 'bg-success',
};

/** One item on a day: the layer's dot, the time when it has one, the title. */
export function CalendarChip({
  layer,
  time,
  title,
  done,
  onOpen,
}: {
  layer: CalendarLayer;
  time: string | null;
  title: string;
  done?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className="flex w-full min-w-0 items-center gap-1.5 rounded-xs px-1.5 py-0.5 text-left text-xs transition-colors duration-fast hover:bg-hover-surface"
    >
      <span className={cn('size-1.5 shrink-0 rounded-pill', LAYER_TONE[layer])} aria-hidden />
      {time ? <span className="figures shrink-0 font-mono text-fg-subtle">{time}</span> : null}
      <span
        className={cn('min-w-0 flex-1 truncate', done ? 'text-fg-subtle line-through' : 'text-fg')}
      >
        {title}
      </span>
    </button>
  );
}
