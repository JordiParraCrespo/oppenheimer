import { cn } from '@oppenheimer/design-system-web';
import { type ReactNode, useState } from 'react';

/** Items a day shows before "+n more". */
const VISIBLE = 3;

/**
 * One day of the month grid: its number (ringed today, muted outside the
 * month), up to three items and "+n more", which shows the rest. The "+"
 * starts a New event on that day; an item opens itself.
 */
export function DayCell({
  number,
  today,
  outside,
  moreLabel,
  newLabel,
  onNew,
  items,
}: {
  number: number;
  today: boolean;
  outside: boolean;
  /** "+2 more", for how many are folded. */
  moreLabel: (count: number) => string;
  newLabel: string;
  onNew: () => void;
  items: ReactNode[];
}) {
  const [expanded, setExpanded] = useState(false);
  const folded = expanded ? 0 : Math.max(0, items.length - VISIBLE);
  return (
    <div
      className={cn(
        'group/day flex min-h-28 min-w-0 flex-col gap-0.5 border-border-subtle border-t border-l p-1.5',
        outside && 'bg-hover-surface/50',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'figures flex size-6 items-center justify-center rounded-pill font-mono text-xs',
            today
              ? 'bg-primary text-primary-foreground'
              : outside
                ? 'text-fg-subtle'
                : 'text-fg-muted',
          )}
        >
          {number}
        </span>
        <button
          type="button"
          aria-label={newLabel}
          onClick={onNew}
          className="rounded-xs px-1 text-sm text-fg-subtle opacity-0 transition-opacity duration-fast group-hover/day:opacity-100 hover:text-fg focus-visible:opacity-100"
        >
          +
        </button>
      </div>
      {folded ? items.slice(0, VISIBLE) : items}
      {folded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start rounded-xs px-1.5 text-xs text-fg-subtle hover:text-fg"
        >
          {moreLabel(folded)}
        </button>
      ) : null}
    </div>
  );
}
