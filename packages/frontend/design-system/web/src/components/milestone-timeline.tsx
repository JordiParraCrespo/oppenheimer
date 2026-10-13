'use client';

import { FolderIcon } from 'lucide-react';
import * as React from 'react';

import { dateFormat, dateOf, type IsoDate } from '../internal/month';
import { cn } from '../lib/utils';

/** Pixels per day: a week is 112px, enough for a week number and a label. */
const PX = 16;
const DAY = 864e5;

type TimelineMilestone = {
  id: string;
  name: string;
  due: IsoDate;
  /** Tasks done and tasks in it; done when every task is. */
  done: number;
  total: number;
};

type TimelineRow = {
  id: string;
  name: string;
  /** The share of the project's tasks that are done, 0–100. */
  progress: number;
  milestones: TimelineMilestone[];
};

/**
 * MilestoneGlyph — a milestone's mark: an 8px square turned 45° on a 1.5px
 * stroke in the current ink. On the sidebar's Milestones row, the filter
 * pill and the View card; `filled` for one whose tasks are all done.
 */
function MilestoneGlyph({ filled = false, className }: { filled?: boolean; className?: string }) {
  return (
    <span
      data-slot="milestone-glyph"
      aria-hidden
      className={cn(
        'mx-0.5 inline-block size-2 shrink-0 rotate-45 border-[1.5px] border-current',
        filled && 'bg-current',
        className,
      )}
    />
  );
}

function daysBetween(a: Date, b: Date) {
  return Math.round((+b - +a) / DAY);
}

/**
 * MilestoneTimeline — Plan's milestones laid out on time, one row per
 * project. It scrolls sideways with no bar and opens on today.
 *
 * - **Header** (56px): the months in 11px uppercase at their first day, each
 *   with a hairline down into the rows; week numbers in mono under them; today
 *   as an inverted mono pill with a line through every row.
 * - **Row** (112px): the project's name with its folder and its done share,
 *   over a 30px track on the card from three weeks before its first
 *   milestone (or today) to ten days past its last.
 * - **Milestone**: a 10px diamond on the track at its due day, its name under
 *   it. Open is the card with a muted stroke; done fills muted; under the
 *   pointer or focus it fills in ink, grows to 1.2 and shows a card with the
 *   share done, the task count and the due day.
 *
 * `today` is the caller's clock, as an ISO day. Dates format in `locale`.
 *
 * ```tsx
 * <MilestoneTimeline rows={rows} today="2026-10-13" onOpenMilestone={edit} onOpenRow={openProject} />
 * ```
 */
function MilestoneTimeline({
  rows,
  today,
  locale = 'en',
  onOpenRow,
  onOpenMilestone,
  labels,
  className,
}: {
  rows: TimelineRow[];
  today: IsoDate;
  locale?: string;
  onOpenRow?: (id: string) => void;
  onOpenMilestone?: (id: string) => void;
  labels?: {
    /** "4 of 6 tasks": the hover card's count, after the share. */
    tasks?: (total: number) => string;
    edit?: string;
  };
  className?: string;
}) {
  const [hover, setHover] = React.useState<string | null>(null);
  const tasksLabel = labels?.tasks ?? ((total: number) => `of ${total} tasks`);
  const now = dateOf(today);

  const spans = rows
    .filter((r) => r.milestones.length > 0)
    .map((r) => {
      const dues = r.milestones.map((m) => +dateOf(m.due));
      return {
        row: r,
        from: new Date(Math.min(Math.min(...dues), +now) - 21 * DAY),
        to: new Date(Math.max(...dues) + 10 * DAY),
      };
    });

  let start = new Date(Math.min(+now, ...spans.map((s) => +s.from)) - 14 * DAY);
  start = new Date(start.getFullYear(), start.getMonth(), start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(Math.max(+now + 42 * DAY, ...spans.map((s) => +s.to)) + 14 * DAY);
  const xOf = (d: Date) => daysBetween(start, d) * PX;

  const weeks: { x: number; label: number }[] = [];
  for (let d = start; d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
    weeks.push({ x: xOf(d), label: d.getDate() });
  }
  const months: { x: number; label: string }[] = [];
  const short = dateFormat(locale, { month: 'short' });
  const withYear = dateFormat(locale, { month: 'short', year: 'numeric' });
  for (let d = new Date(start.getFullYear(), start.getMonth() + 1, 1), k = 0; d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1), k++) {
    months.push({ x: xOf(d), label: (k === 0 || d.getMonth() === 0 ? withYear : short).format(d) });
  }
  const todayX = xOf(now);
  const todayLabel = dateFormat(locale, { day: 'numeric', month: 'short' }).format(now);
  const dueFormat = dateFormat(locale, { month: 'short', day: 'numeric' });

  // Open on today, a third in from the left, once: the reader scrolls from there.
  const opened = React.useRef(false);
  const scroller = (el: HTMLDivElement | null) => {
    if (el && !opened.current) {
      opened.current = true;
      el.scrollLeft = Math.max(0, todayX - el.clientWidth / 3);
    }
  };

  return (
    <div
      ref={scroller}
      data-slot="milestone-timeline"
      className={cn('overflow-x-auto overflow-y-hidden overscroll-x-contain pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
    >
      <div className="relative min-w-full" style={{ width: xOf(end) + 40 }}>
        <div className="relative h-14 border-b border-border-subtle">
          {months.map((m) => (
            <React.Fragment key={m.x}>
              <span
                className="absolute top-1 text-[11px] font-medium tracking-[0.02em] whitespace-nowrap text-fg-muted uppercase"
                style={{ left: m.x }}
              >
                {m.label}
              </span>
              <span className="absolute top-6 -bottom-px w-px bg-border-subtle" style={{ left: m.x }} />
            </React.Fragment>
          ))}
          {weeks.map((w) => (
            <span
              key={w.x}
              className="figures absolute top-7.5 -translate-x-1/2 font-mono text-[12px] text-fg-subtle"
              style={{ left: w.x }}
            >
              {w.label}
            </span>
          ))}
          <span
            className="figures absolute top-6.75 z-2 inline-flex h-5.5 -translate-x-1/2 items-center rounded-pill bg-fg px-2 font-mono text-[11.5px] font-medium whitespace-nowrap text-canvas uppercase"
            style={{ left: todayX }}
          >
            {todayLabel}
          </span>
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute top-14 bottom-0 z-1 w-px bg-fg opacity-35"
          style={{ left: todayX }}
        />
        {spans.map(({ row, from, to }) => (
          <div key={row.id} className="relative h-28">
            <button
              type="button"
              onClick={() => onOpenRow?.(row.id)}
              className="absolute top-4.5 flex items-center gap-2 text-[15px] font-medium tracking-[-0.011em] whitespace-nowrap text-fg outline-none hover:text-link focus-visible:text-link"
              style={{ left: xOf(from) }}
            >
              <FolderIcon className="size-3.75 text-fg-muted" />
              {row.name}
              <span className="figures font-mono text-[12px] font-normal text-fg-subtle">{row.progress}%</span>
            </button>
            <div
              className="absolute top-12 h-7.5 rounded-sm border border-border-subtle bg-card"
              style={{ left: xOf(from), width: xOf(to) - xOf(from) }}
            />
            {row.milestones.map((m) => {
              const x = xOf(dateOf(m.due));
              const lit = hover === m.id;
              const complete = m.total > 0 && m.done === m.total;
              const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
              const handlers = {
                onClick: () => onOpenMilestone?.(m.id),
                onMouseEnter: () => setHover(m.id),
                onMouseLeave: () => setHover((h) => (h === m.id ? null : h)),
                onFocus: () => setHover(m.id),
                onBlur: () => setHover((h) => (h === m.id ? null : h)),
              };
              return (
                <React.Fragment key={m.id}>
                  <button
                    type="button"
                    aria-label={m.name}
                    className="absolute top-13.25 flex size-5 -translate-x-1/2 items-center justify-center outline-none"
                    style={{ left: x }}
                    {...handlers}
                  >
                    <span
                      className={cn(
                        'size-2.5 rotate-45 border-[1.5px] transition-transform duration-instant ease-standard',
                        lit ? 'scale-120 border-fg bg-fg' : complete ? 'border-fg-muted bg-fg-muted' : 'border-fg-muted bg-card',
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    className={cn(
                      'absolute top-21 -translate-x-1/2 text-[12.5px] whitespace-nowrap outline-none',
                      lit ? 'text-fg' : 'text-fg-muted',
                    )}
                    style={{ left: x }}
                    {...handlers}
                  >
                    {m.name}
                  </button>
                  {lit ? (
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute top-0 z-5 flex animate-in flex-col gap-2 rounded-md border border-border-subtle bg-card px-3.5 py-3 whitespace-nowrap shadow-popover fade-in-0 slide-in-from-bottom-1"
                      style={{ left: x + 18 }}
                    >
                      <span className="flex items-center gap-2.5 text-[14px] font-medium">
                        <span
                          className={cn('size-2.25 rotate-45 border-[1.5px] border-fg', complete ? 'bg-fg-muted' : 'bg-fg')}
                        />
                        {m.name}
                      </span>
                      <span className="flex items-center gap-2 text-[12.5px] text-fg-muted">
                        <span className="h-1 w-10 overflow-hidden rounded-pill bg-hover-surface">
                          <span className="block h-full bg-fg" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="figures font-mono text-fg">{pct}%</span>
                        {tasksLabel(m.total)}
                        <span className="text-fg-subtle">·</span>
                        <span className="figures font-mono">{dueFormat.format(dateOf(m.due))}</span>
                      </span>
                      {onOpenMilestone ? (
                        <span className="text-[12px] text-fg-subtle">{labels?.edit ?? 'Click to edit'}</span>
                      ) : null}
                    </div>
                  ) : null}
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export { MilestoneGlyph, MilestoneTimeline };
export type { TimelineMilestone, TimelineRow };
