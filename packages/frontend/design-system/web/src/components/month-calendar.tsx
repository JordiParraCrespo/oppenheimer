'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { CircleCheckIcon, XIcon, ZapIcon } from 'lucide-react';
import type * as React from 'react';

import { dateFormat, dateOf, type IsoDate, type MonthDay } from '../internal/month';
import { DayNumber, MonthGrid } from '../internal/month-grid';
import { cn } from '../lib/utils';
import { useDraggable, useDroppable } from './drag';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

/**
 * MonthCalendar — Plan's month: a card with the weekday eyebrows over whole
 * weeks, Monday first. Days outside the month sit on the hover wash with
 * their entries faded; today's number is a filled circle; the 1st reads
 * "Oct 1". A day lists its entries in time order; past four it shows three
 * and "N more", which opens the whole day in a popover.
 *
 * Entries move by dragging one onto another day, on the drag layer, inside
 * the page's `DragProvider` (the calendar owns no provider, so it shares one
 * surface with whatever else the page drags). Each entry is a source of type
 * `calendar-entry`, each day a target whose id is its ISO date, so the
 * caller's `onDragEnd` reads the move as `active.id` onto `over.id`; draw
 * the lifted copy with `<CalendarEntry entry={…} lifted />`. An entry is
 * draggable unless `draggable` is false (an automation run, which follows
 * its schedule). The "N more" popover lists the day to read and open, not
 * to drag. Clicking a day's empty space is `onAddDay`.
 */

type CalendarEntryKind = 'event' | 'task' | 'automation';

interface CalendarEntryData {
  id: string;
  date: IsoDate;
  kind: CalendarEntryKind;
  title: string;
  /** "09:30"; absent for an all-day event and a task's due date. */
  time?: string;
  allDay?: boolean;
  /** An event that blocks time; free ones read muted. */
  busy?: boolean;
  /** A task that is done: green check, struck title. */
  done?: boolean;
  draggable?: boolean;
  /** The native tooltip ("Design review · 15:00–16:00"). */
  tip?: string;
}

/** Events first by time, all-day ones above; then a task's due date; then by time. */
function entryOrder(entry: CalendarEntryData): number {
  if (entry.allDay) return -2;
  if (entry.kind === 'task') return -1;
  if (!entry.time) return 0;
  const [h, m] = entry.time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * One entry, as the calendar draws it: a ring for a timed event, a check for
 * a task, a bolt for an automation run; the time in mono; the title. An
 * all-day event is a filled bar. `full` keeps the time even where a cramped
 * day would drop it (the day popover).
 */
function CalendarEntry({
  entry,
  full = false,
  lifted = false,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  entry: CalendarEntryData;
  full?: boolean;
  /** The copy that follows the pointer: a day's width, on the card. */
  lifted?: boolean;
}) {
  const muted = entry.kind === 'automation' || entry.done || (entry.kind === 'event' && !entry.busy);
  return (
    <button
      type="button"
      data-slot="calendar-entry"
      data-kind={entry.kind}
      title={entry.tip ?? entry.title}
      className={cn(
        'flex h-6 w-full min-w-0 items-center gap-1.5 rounded-xs px-1.5 text-left text-xs outline-none transition-colors duration-instant ease-standard hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-ring',
        entry.allDay && 'bg-control',
        muted ? 'text-fg-muted' : 'text-fg',
        full && 'h-[26px] px-2',
        lifted && 'w-44 bg-card',
        className,
      )}
      {...props}
    >
      {entry.kind === 'event' && !entry.allDay ? (
        <span
          aria-hidden
          className={cn(
            'size-2 shrink-0 rounded-pill border-[1.5px]',
            entry.busy ? 'border-fg-muted' : 'border-fg-subtle',
          )}
        />
      ) : null}
      {entry.kind === 'task' ? (
        <CircleCheckIcon
          aria-hidden
          className={cn('size-3 shrink-0', entry.done ? 'text-success' : 'text-fg-subtle')}
        />
      ) : null}
      {entry.kind === 'automation' ? <ZapIcon aria-hidden className="size-[11px] shrink-0 text-fg-subtle" /> : null}
      {entry.time ? (
        <span className={cn('figures shrink-0 text-micro text-fg-subtle', !full && '@max-[140px]/day:hidden')}>
          {entry.time}
        </span>
      ) : null}
      <span className={cn('min-w-0 flex-1 truncate', muted ? 'font-normal' : 'font-medium', entry.done && 'line-through')}>
        {entry.title}
      </span>
    </button>
  );
}

function DraggableEntry({ entry, onOpen }: { entry: CalendarEntryData; onOpen?: (id: string) => void }) {
  const movable = entry.draggable !== false;
  const { ref, handleProps, isDragging } = useDraggable({ id: entry.id, data: { type: 'calendar-entry', label: entry.title }, disabled: !movable });
  return (
    <CalendarEntry
      ref={ref}
      entry={entry}
      data-dragging={isDragging || undefined}
      className="touch-none data-dragging:opacity-40"
      {...(movable ? handleProps : {})}
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.(entry.id);
      }}
    />
  );
}

function CalendarDay({
  day,
  entries,
  today,
  last,
  dayLabel,
  monthDayLabel,
  moreLabel,
  closeLabel,
  onOpenEntry,
  onAddDay,
}: {
  day: MonthDay;
  entries: CalendarEntryData[];
  today: boolean;
  last: { row: boolean; first: boolean; end: boolean };
  dayLabel: string;
  monthDayLabel: string;
  moreLabel: (n: number) => string;
  closeLabel: string;
  onOpenEntry?: (id: string) => void;
  onAddDay?: (date: IsoDate) => void;
}) {
  const { ref, isOver } = useDroppable({ id: day.iso, data: { label: dayLabel, date: day.iso }, accepts: ['calendar-entry'] });
  const shown = entries.length > 4 ? entries.slice(0, 3) : entries;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: adding from a day is also the page's New event button.
    // biome-ignore lint/a11y/noStaticElementInteractions: the day's empty space is a shortcut, not the only way to add.
    <div
      ref={ref}
      data-slot="calendar-day"
      data-today={today || undefined}
      data-outside={!day.inMonth || undefined}
      data-over={isOver || undefined}
      onClick={() => onAddDay?.(day.iso)}
      className={cn(
        '@container/day relative flex min-h-[150px] min-w-0 flex-col gap-0.5 px-1.5 pt-1.5 pb-2 transition-[background-color] duration-instant ease-standard',
        'border-border-subtle not-first:border-l [&:nth-child(7n+1)]:border-l-0 [&:nth-child(n+8)]:border-t',
        !day.inMonth && 'bg-hover-surface',
        isOver && 'bg-selected-surface',
        last.row && last.first && 'rounded-bl-[17px]',
        last.row && last.end && 'rounded-br-[17px]',
      )}
    >
      <div className="flex h-[26px] items-center px-0.5 pb-0.5">
        <DayNumber day={day} face="calendar" today={today}>
          {day.day === 1 ? monthDayLabel : day.day}
        </DayNumber>
      </div>
      <div className={cn('flex flex-col gap-0.5', !day.inMonth && 'opacity-55')}>
        {shown.map((entry) => (
          <DraggableEntry key={entry.id} entry={entry} onOpen={onOpenEntry} />
        ))}
      </div>
      {entries.length > 4 ? (
        <Popover>
          <PopoverTrigger
            onClick={(event) => event.stopPropagation()}
            className="h-[22px] self-start rounded-xs px-1.5 text-xs text-fg-muted outline-none transition-colors duration-instant ease-standard hover:bg-hover-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
          >
            {moreLabel(entries.length - 3)}
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="bottom"
            sideOffset={-22}
            onClick={(event) => event.stopPropagation()}
            className="w-62 gap-0.5 rounded-md border-0 p-2 shadow-popover"
          >
            <div className="flex items-center gap-1.5 pt-0.5 pr-0.5 pb-1.5 pl-1.5">
              <span className="flex-1 text-sm font-medium text-fg">{dayLabel}</span>
              <CloseButton label={closeLabel} />
            </div>
            <div className="flex max-h-75 flex-col gap-0.5 overflow-y-auto overscroll-contain [scrollbar-width:none]">
              {entries.map((entry) => (
                <CalendarEntry key={entry.id} entry={entry} full onClick={() => onOpenEntry?.(entry.id)} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

/** The popover's close, as the popover's own close action. */
function CloseButton({ label }: { label: string }) {
  return (
    <PopoverPrimitive.Close
      aria-label={label}
      className="flex size-(--control-h-sm) items-center justify-center rounded-pill text-fg-muted outline-none hover:bg-hover-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
    >
      <XIcon className="size-3.5" aria-hidden />
    </PopoverPrimitive.Close>
  );
}

const moreInEnglish = (n: number) => `${n} more`;

function MonthCalendar({
  year,
  month,
  entries,
  today,
  locale = 'en',
  onOpenEntry,
  onAddDay,
  moreLabel = moreInEnglish,
  closeLabel = 'Close',
  className,
}: {
  year: number;
  /** 0 for January. */
  month: number;
  entries: readonly CalendarEntryData[];
  /** Today, to fill; the caller's clock, so a page never reads one in render. */
  today?: IsoDate;
  /** Names the weekdays and the days. */
  locale?: string;
  onOpenEntry?: (id: string) => void;
  onAddDay?: (date: IsoDate) => void;
  moreLabel?: (n: number) => string;
  closeLabel?: string;
  className?: string;
}) {
  const longDay = dateFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  const monthDay = dateFormat(locale, { month: 'short', day: 'numeric' });
  const byDay = new Map<IsoDate, CalendarEntryData[]>();
  for (const entry of entries) {
    const list = byDay.get(entry.date) ?? [];
    list.push(entry);
    byDay.set(entry.date, list);
  }

  return (
    <section data-slot="month-calendar" className={cn('rounded-lg border border-border-subtle bg-card', className)}>
      <MonthGrid year={year} month={month} locale={locale} face="calendar">
        {(day, { index, count }) => (
          <CalendarDay
            key={day.iso}
            day={day}
            entries={(byDay.get(day.iso) ?? []).slice().sort((a, b) => entryOrder(a) - entryOrder(b))}
            today={day.iso === today}
            last={{ row: index >= count - 7, first: index % 7 === 0, end: index % 7 === 6 }}
            dayLabel={longDay.format(dateOf(day.iso))}
            monthDayLabel={monthDay.format(dateOf(day.iso))}
            moreLabel={moreLabel}
            closeLabel={closeLabel}
            onOpenEntry={onOpenEntry}
            onAddDay={onAddDay}
          />
        )}
      </MonthGrid>
    </section>
  );
}

export { CalendarEntry, MonthCalendar };
export type { CalendarEntryData, CalendarEntryKind };
