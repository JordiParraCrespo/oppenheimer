import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * GoalCard — a goal above Plan's board: its name, the project and the due
 * date in mono, its menu (`action`, an ellipsis), and how many of its tasks
 * are done as a 4px bar with "1 / 4 tasks" and the percentage in mono. The
 * bar is full ink, and turns green at 100%.
 *
 * The card is a toggle: picking it narrows the board to the goal's tasks,
 * and while `selected` it takes the selected wash with the ring's border.
 * `GoalGrid` lays the cards out at 280px or more each; `GoalEmpty` stands in
 * for a project with no goals, and is the way to add one.
 */
function GoalCard({
  name,
  meta,
  done,
  total,
  countLabel,
  selected = false,
  action,
  onSelect,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onSelect'> & {
  name: React.ReactNode;
  /** "XRP Mobile · Nov 1": the project, then the due date in a `figures` span. */
  meta?: React.ReactNode;
  done: number;
  total: number;
  /** "1 / 4 tasks", the caller's words. */
  countLabel: React.ReactNode;
  selected?: boolean;
  /** The goal's menu, an `IconButton` with an ellipsis. */
  action?: React.ReactNode;
  onSelect?: () => void;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      data-slot="goal-card"
      data-selected={selected || undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect?.();
        }
      }}
      className={cn(
        'flex cursor-pointer flex-col gap-3.5 rounded-lg border border-border-subtle bg-card py-4 pr-3.5 pl-4.5 outline-none transition-[background-color,border-color] duration-fast ease-standard focus-visible:outline-2 focus-visible:outline-ring data-selected:border-ring data-selected:bg-selected-surface',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[15px] leading-[1.35] font-medium tracking-[-0.011em] text-pretty text-fg">{name}</span>
          {meta ? <span className="text-[12.5px] text-fg-muted [&_.figures]:text-xs">{meta}</span> : null}
        </div>
        {action ? (
          // biome-ignore lint/a11y/noStaticElementInteractions: only keeps the menu's click off the card's toggle.
          <span className="-mt-1 shrink-0" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
            {action}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-1 overflow-hidden rounded-pill bg-hover-surface"
        >
          <div
            className={cn(
              'h-full rounded-pill transition-[width] duration-slow ease-standard',
              pct === 100 ? 'bg-success' : 'bg-fg',
            )}
            // biome-ignore lint/style/noInlineStyles: the share done is data.
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="figures flex items-baseline justify-between text-[11.5px] text-fg-muted">
          <span className="whitespace-nowrap">{countLabel}</span>
          <span>{pct}%</span>
        </div>
      </div>
    </div>
  );
}

function GoalGrid({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="goal-grid"
      className={cn('grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3', className)}
      {...props}
    />
  );
}

/** No goals yet: a dashed card that says what a goal is and adds one. */
function GoalEmpty({
  title,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & { title: React.ReactNode }) {
  return (
    <button
      type="button"
      data-slot="goal-empty"
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border border-dashed border-border px-4.5 py-4 text-left text-[13px] text-fg-muted outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    >
      <span className="text-[15px] font-medium text-fg">{title}</span>
      {children}
    </button>
  );
}

export { GoalCard, GoalEmpty, GoalGrid };
