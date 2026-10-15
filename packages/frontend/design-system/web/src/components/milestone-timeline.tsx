'use client';

import { FolderIcon } from 'lucide-react';
import * as React from 'react';

import { dateFormat, dateOf, type IsoDate } from '../internal/month';
import { cn } from '../lib/utils';

/** Pixels per day: a week is 112px, enough for a week number and a label. */
const PX = 16;
const DAY = 864e5;
/** A project's track starts three weeks before its first milestone (or today)… */
const LEAD_DAYS = 21;
/** …and runs ten days past its last. */
const TAIL_DAYS = 10;
/** The timeline keeps two weeks of room past the earliest and the latest track… */
const MARGIN_DAYS = 14;
/** …and always shows six weeks ahead of today. */
const AHEAD_DAYS = 42;

type TimelineMilestone = {
  id: string;
  name: string;
  due: IsoDate;
  /** Tasks done and tasks in it; done when every task is. */
  done: number;
  total: number;
};

/** What a page's Today, Earlier and Later buttons do to the timeline. */
type MilestoneTimelineControls = {
  /** Scroll today back to a quarter in from the left. */
  today: () => void;
  /** Four weeks back. */
  earlier: () => void;
  /** Four weeks on. */
  later: () => void;
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
 * Where everything sits: each project's span (three weeks before its first
 * milestone or today, to ten days past its last), the timeline's start on a
 * Monday two weeks before the earliest span, its end six weeks past today
 * at least, and the week and month marks between.
 */
function layout(rows: TimelineRow[], today: IsoDate, locale: string) {
  const now = dateOf(today);
  const spans = rows
    .filter((r) => r.milestones.length > 0)
    .map((r) => {
      const dues = r.milestones.map((m) => +dateOf(m.due));
      return {
        row: r,
        from: new Date(Math.min(Math.min(...dues), +now) - LEAD_DAYS * DAY),
        to: new Date(Math.max(...dues) + TAIL_DAYS * DAY),
      };
    });
  const earliest = new Date(Math.min(+now, ...spans.map((s) => +s.from)) - MARGIN_DAYS * DAY);
  const start = new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate() - ((earliest.getDay() + 6) % 7));
  const end = new Date(Math.max(+now + AHEAD_DAYS * DAY, ...spans.map((s) => +s.to)) + MARGIN_DAYS * DAY);
  const xOf = (d: Date) => daysBetween(start, d) * PX;

  const weeks: { x: number; label: number }[] = [];
  for (let d = start; d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
    weeks.push({ x: xOf(d), label: d.getDate() });
  }
  const months: { x: number; label: string }[] = [];
  const short = dateFormat(locale, { month: 'short' });
  const withYear = dateFormat(locale, { month: 'short', year: 'numeric' });
  let first = true;
  for (let d = new Date(start.getFullYear(), start.getMonth() + 1, 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    months.push({ x: xOf(d), label: (first || d.getMonth() === 0 ? withYear : short).format(d) });
    first = false;
  }
  return { spans, weeks, months, todayX: xOf(now), width: xOf(end) + 40, xOf };
}

/**
 * One milestone on its track: the diamond at its due day (open on the card,
 * done filled muted, lit in ink and grown under the pointer or focus), its
 * name under it, and while lit the card with its share, task count and due
 * day. The pointer and focus both light it, on either of its two buttons.
 */
function MilestoneMarker({
  milestone: m,
  x,
  lit,
  due,
  tasksLabel,
  editLabel,
  onOpen,
  onHover,
}: {
  milestone: TimelineMilestone;
  x: number;
  lit: boolean;
  due: string;
  tasksLabel: (total: number) => string;
  /** The hover card's last line when a click opens the milestone. */
  editLabel?: string;
  onOpen: () => void;
  onHover: (on: boolean) => void;
}) {
  const complete = m.total > 0 && m.done === m.total;
  const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
  const handlers = {
    onClick: onOpen,
    onMouseEnter: () => onHover(true),
    onMouseLeave: () => onHover(false),
    onFocus: () => onHover(true),
    onBlur: () => onHover(false),
  };
  return (
    <>
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
            <span className={cn('size-2.25 rotate-45 border-[1.5px] border-fg', complete ? 'bg-fg-muted' : 'bg-fg')} />
            {m.name}
          </span>
          <span className="flex items-center gap-2 text-[12.5px] text-fg-muted">
            <span className="h-1 w-10 overflow-hidden rounded-pill bg-hover-surface">
              <span className="block h-full bg-fg" style={{ width: `${pct}%` }} />
            </span>
            <span className="figures font-mono text-fg">{pct}%</span>
            {tasksLabel(m.total)}
            <span className="text-fg-subtle">·</span>
            <span className="figures font-mono">{due}</span>
          </span>
          {editLabel ? <span className="text-[12px] text-fg-subtle">{editLabel}</span> : null}
        </div>
      ) : null}
    </>
  );
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
  controls,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
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
  /** A handle for the page's Today, Earlier and Later buttons. */
  controls?: React.Ref<MilestoneTimelineControls>;
}) {
  const [hover, setHover] = React.useState<string | null>(null);
  const tasksLabel = labels?.tasks ?? ((total: number) => `of ${total} tasks`);
  const { spans, weeks, months, todayX, width, xOf } = layout(rows, today, locale);
  const now = dateOf(today);
  const todayLabel = dateFormat(locale, { day: 'numeric', month: 'short' }).format(now);
  const dueFormat = dateFormat(locale, { month: 'short', day: 'numeric' });

  // Open on today, a quarter in from the left (past a 32px gutter when the
  // page bleeds it), once: the reader scrolls from there, and Today comes back.
  // A track that runs through today pulls the view left to show its start and
  // its name, as long as today stays in the left two thirds.
  const opened = React.useRef(false);
  const element = React.useRef<HTMLDivElement | null>(null);
  const current = spans.filter((s) => +s.to >= +now).map((s) => xOf(s.from));
  const onToday = (el: HTMLDivElement) => {
    const at = (share: number) => todayX + 32 - el.clientWidth * share;
    return Math.max(0, Math.max(Math.min(at(0.25), ...current), at(2 / 3)));
  };
  const scroller = (el: HTMLDivElement | null) => {
    element.current = el;
    if (el && !opened.current) {
      opened.current = true;
      el.scrollLeft = onToday(el);
    }
  };
  React.useImperativeHandle(
    controls,
    () => ({
      today: () => {
        const el = element.current;
        el?.scrollTo({ left: el ? onToday(el) : 0, behavior: 'smooth' });
      },
      earlier: () => element.current?.scrollBy({ left: -28 * PX, behavior: 'smooth' }),
      later: () => element.current?.scrollBy({ left: 28 * PX, behavior: 'smooth' }),
    }),
  );

  return (
    <div
      {...props}
      ref={scroller}
      data-slot="milestone-timeline"
      className={cn('overflow-x-auto overflow-y-hidden overscroll-x-contain pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
    >
      <div className="relative min-w-full" style={{ width }}>
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
            {/* The name rides its track: it sticks to the left edge while the
                track is scrolled past it, and leaves with the track's end. */}
            <div className="absolute top-4.5" style={{ left: xOf(from), width: xOf(to) - xOf(from) }}>
              <button
                type="button"
                onClick={() => onOpenRow?.(row.id)}
                className="sticky left-4 flex w-max items-center gap-2 text-[15px] font-medium tracking-[-0.011em] whitespace-nowrap text-fg outline-none hover:text-link focus-visible:text-link"
              >
                <FolderIcon className="size-3.75 text-fg-muted" />
                {row.name}
                <span className="figures font-mono text-[12px] font-normal text-fg-subtle">{row.progress}%</span>
              </button>
            </div>
            <div
              className="absolute top-12 h-7.5 rounded-sm border border-border-subtle bg-card"
              style={{ left: xOf(from), width: xOf(to) - xOf(from) }}
            />
            {row.milestones.map((m) => (
              <MilestoneMarker
                key={m.id}
                milestone={m}
                x={xOf(dateOf(m.due))}
                lit={hover === m.id}
                due={dueFormat.format(dateOf(m.due))}
                tasksLabel={tasksLabel}
                editLabel={onOpenMilestone ? (labels?.edit ?? 'Click to edit') : undefined}
                onOpen={() => onOpenMilestone?.(m.id)}
                onHover={(on) => setHover((h) => (on ? m.id : h === m.id ? null : h))}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export { MilestoneGlyph, MilestoneTimeline };
export type { MilestoneTimelineControls, TimelineMilestone, TimelineRow };
