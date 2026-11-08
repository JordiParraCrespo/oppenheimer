'use client';

import { CircleCheckIcon, ZapIcon } from 'lucide-react';
import type * as React from 'react';

import { dateFormat, dateOf, type IsoDate } from '../internal/month';
import { cn } from '../lib/utils';
import { useDraggable, useDroppable } from './drag';
import { CalendarEntry, type CalendarEntryData } from './month-calendar';

/**
 * AgendaCalendar — Plan's Day and Week (the 2026-11-08 `Tasks` frame): a card
 * with one column per day, each headed by its weekday and number (today
 * filled), an All day row, then the hours from 07:00 to 22:00 ruled every
 * hour. A timed entry is a block from its `time` to its `end` (half an hour
 * when it names none); entries that overlap share the column side by side.
 * One that starts before 07:00 or from 22:00 sits in All day with its time,
 * so nothing on the day goes undrawn. Busy events sit on the control wash, a task on the card with a border and
 * its check, an automation run and a free event on the card, muted. Today's
 * column carries a line at `now`.
 *
 * Entries move by dragging, on the drag layer inside the page's
 * `DragProvider`, as on `MonthCalendar`: each entry is a `calendar-entry`
 * source, each day's All day cell a target whose id is the ISO date, and each
 * half hour a target whose id is `<date>T<HH:MM>` (`agendaSlot` reads one
 * back). Clicking a half hour's empty space is `onAddSlot`; a column's head
 * is `onOpenDay`.
 */

const START_HOUR = 7;
const END_HOUR = 22;
const SLOT_MINUTES = 30;

interface AgendaEntryData extends CalendarEntryData {
  /** "10:30": where a timed block ends; half an hour after `time` when absent. */
  end?: string;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function timeOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** A half hour target's id: the day and the time it starts at. */
function agendaSlotId(date: IsoDate, time: string): string {
  return `${date}T${time}`;
}

/** A target id back into its day and time; a bare day (the All day row) has no time. */
function agendaSlot(id: string): { date: IsoDate; time: string | null } {
  const [date, time] = id.split('T');
  return { date: date ?? id, time: time ?? null };
}

interface Placed {
  entry: AgendaEntryData;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

/** A timed entry that starts on the hours drawn; one before 07:00 or from 22:00 sits in All day with its time. */
function onTheHours(entry: AgendaEntryData): boolean {
  if (entry.allDay || !entry.time) return false;
  const start = minutesOf(entry.time);
  return start >= START_HOUR * 60 && start < END_HOUR * 60;
}

/** Timed entries in lanes: each takes the first lane free at its start, and as many share as overlap. */
function place(entries: readonly AgendaEntryData[]): Placed[] {
  const timed = entries
    .filter(onTheHours)
    .map((entry) => {
      const start = minutesOf(entry.time as string);
      const end = entry.end ? minutesOf(entry.end) : start + SLOT_MINUTES;
      return { entry, start, end: Math.max(end, start + 15), lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const ends: number[] = [];
  for (const item of timed) {
    let lane = ends.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = ends.length;
      ends.push(0);
    }
    ends[lane] = item.end;
    item.lane = lane;
  }
  for (const item of timed) {
    const overlapping = timed.filter((other) => other.start < item.end && other.end > item.start);
    item.lanes = 1 + Math.max(...overlapping.map((other) => other.lane));
  }
  return timed;
}

/**
 * An entry as a drag source that opens on a click: the props both renderers
 * spread, so a block and an All day entry pick up, fade and open alike.
 */
function useEntryDrag(entry: AgendaEntryData, onOpen?: (id: string) => void) {
  const movable = entry.draggable !== false;
  const { ref, handleProps, isDragging } = useDraggable({
    id: entry.id,
    data: { type: 'calendar-entry', label: entry.title },
    disabled: !movable,
  });
  return {
    ref,
    ...(movable ? handleProps : {}),
    'data-dragging': isDragging || undefined,
    onClick: (event: React.MouseEvent) => {
      event.stopPropagation();
      onOpen?.(entry.id);
    },
  };
}

/**
 * Where a placed block sits and how it reads: its box on the hours, short
 * (a row) under 52px, the surface and ink its kind takes, and whether its
 * time fits (a short block in a week's narrow column drops it).
 */
function blockLook(placed: Placed, hourHeight: number, compact: boolean) {
  const { entry, start, end, lane, lanes } = placed;
  const y = (minutes: number) =>
    ((Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, minutes)) - START_HOUR * 60) / 60) * hourHeight;
  const top = y(start);
  const height = Math.max(20, y(end) - top - 2);
  const short = height < 52;
  const task = entry.kind === 'task';
  const automation = entry.kind === 'automation';
  const free = entry.kind === 'event' && !entry.busy;
  return {
    box: {
      top: top + 1,
      height,
      left: `calc(${(lane / lanes) * 100}% + 3px)`,
      width: `calc(${100 / lanes}% - 6px)`,
    },
    className: cn(
      short ? 'flex-row items-center gap-1.5 px-2' : 'flex-col items-start gap-0.5 px-2 py-1.5',
      task ? 'z-2 border-border bg-card' : automation ? 'z-1 border-border-subtle bg-card' : free ? 'border-border-subtle bg-card' : 'z-2 border-transparent bg-control',
      automation || free || entry.done ? 'text-fg-muted' : 'text-fg',
      entry.done && 'opacity-60',
    ),
    titleClassName: cn(automation || entry.done ? 'font-normal' : 'font-medium', entry.done && 'line-through'),
    time: short && compact ? null : automation ? (entry.time ?? null) : `${entry.time}–${timeOf(end)}`,
  };
}

function AgendaBlock({
  placed,
  hourHeight,
  compact,
  onOpen,
}: {
  placed: Placed;
  hourHeight: number;
  compact: boolean;
  onOpen?: (id: string) => void;
}) {
  const { entry } = placed;
  const drag = useEntryDrag(entry, onOpen);
  const look = blockLook(placed, hourHeight, compact);
  return (
    <button
      {...drag}
      type="button"
      data-slot="agenda-block"
      data-kind={entry.kind}
      title={entry.tip ?? entry.title}
      style={look.box}
      className={cn(
        'absolute flex touch-none overflow-hidden rounded-xs border text-left outline-none transition-colors duration-instant ease-standard hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-ring data-dragging:opacity-40',
        look.className,
      )}
    >
      <span className="flex min-w-0 max-w-full flex-auto items-center gap-[5px]">
        {entry.kind === 'task' ? (
          <CircleCheckIcon aria-hidden className={cn('size-3 shrink-0', entry.done ? 'text-success' : 'text-fg-subtle')} />
        ) : null}
        {entry.kind === 'automation' ? <ZapIcon aria-hidden className="size-[11px] shrink-0 text-fg-subtle" /> : null}
        <span className={cn('min-w-0 truncate text-xs', look.titleClassName)}>{entry.title}</span>
      </span>
      {look.time ? (
        <span className="figures min-w-0 shrink overflow-hidden whitespace-nowrap text-micro text-fg-muted">{look.time}</span>
      ) : null}
    </button>
  );
}

function AllDayEntry({ entry, onOpen }: { entry: AgendaEntryData; onOpen?: (id: string) => void }) {
  const drag = useEntryDrag(entry, onOpen);
  return (
    <CalendarEntry
      {...drag}
      entry={entry.allDay ? { ...entry, time: undefined } : entry}
      className="touch-none data-dragging:opacity-40"
    />
  );
}

function AllDayCell({
  date,
  label,
  entries,
  onOpen,
}: {
  date: IsoDate;
  label: string;
  entries: AgendaEntryData[];
  onOpen?: (id: string) => void;
}) {
  const { ref, isOver } = useDroppable({ id: date, data: { label, date }, accepts: ['calendar-entry'] });
  return (
    <div
      ref={ref}
      data-slot="agenda-all-day"
      data-over={isOver || undefined}
      className={cn(
        'flex min-h-[38px] min-w-0 flex-col gap-0.5 border-l border-border-subtle p-1.5 transition-[background-color] duration-instant ease-standard',
        isOver && 'bg-selected-surface',
      )}
    >
      {entries.map((entry) => (
        <AllDayEntry key={entry.id} entry={entry} onOpen={onOpen} />
      ))}
    </div>
  );
}

function Slot({
  date,
  minutes,
  label,
  hourHeight,
  onAdd,
}: {
  date: IsoDate;
  minutes: number;
  label: string;
  hourHeight: number;
  onAdd?: (date: IsoDate, time: string) => void;
}) {
  const time = timeOf(minutes);
  const { ref, isOver } = useDroppable({
    id: agendaSlotId(date, time),
    data: { label: `${label} ${time}`, date, time },
    accepts: ['calendar-entry'],
  });
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: adding at a time is also the page's New event button.
    // biome-ignore lint/a11y/noStaticElementInteractions: an empty half hour is a shortcut, not the only way to add.
    <div
      ref={ref}
      data-slot="agenda-slot"
      data-over={isOver || undefined}
      onClick={() => onAdd?.(date, time)}
      style={{ top: ((minutes - START_HOUR * 60) / 60) * hourHeight, height: hourHeight / 2 }}
      className={cn('absolute inset-x-0', isOver && 'bg-selected-surface')}
    />
  );
}

function AgendaCalendar({
  days,
  entries,
  today,
  now,
  locale = 'en',
  allDayLabel = 'All day',
  onOpenEntry,
  onOpenDay,
  onAddSlot,
  className,
}: {
  /** The days drawn, one column each: one for Day, seven for Week. */
  days: readonly IsoDate[];
  entries: readonly AgendaEntryData[];
  /** Today, to fill its number; the caller's clock, so a page never reads one in render. */
  today?: IsoDate;
  /** "14:20": where today's line sits; none when absent. */
  now?: string;
  locale?: string;
  allDayLabel?: string;
  onOpenEntry?: (id: string) => void;
  onOpenDay?: (date: IsoDate) => void;
  onAddSlot?: (date: IsoDate, time: string) => void;
  className?: string;
}) {
  const hourHeight = days.length > 1 ? 48 : 56;
  const columns = { gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` };
  const weekday = dateFormat(locale, { weekday: 'short' });
  const longDay = dateFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const hours = Array.from({ length: END_HOUR - START_HOUR - 1 }, (_, i) => START_HOUR + i + 1);
  const slots = Array.from(
    { length: ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES },
    (_, i) => START_HOUR * 60 + i * SLOT_MINUTES,
  );
  const nowMinutes = now ? minutesOf(now) : null;
  const byDay = new Map<IsoDate, AgendaEntryData[]>();
  for (const entry of entries) {
    const list = byDay.get(entry.date) ?? [];
    list.push(entry);
    byDay.set(entry.date, list);
  }
  const allDay = (date: IsoDate) => (byDay.get(date) ?? []).filter((entry) => !onTheHours(entry));

  return (
    <section
      data-slot="agenda-calendar"
      className={cn('w-full min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-card', className)}
    >
      <div className="grid border-b border-border-subtle" style={columns}>
        <span />
        {days.map((date) => {
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              title={longDay.format(dateOf(date))}
              onClick={() => onOpenDay?.(date)}
              className="flex min-w-0 items-center gap-1.5 border-l border-border-subtle px-2.5 py-2 text-left outline-none transition-colors duration-instant ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <span className="text-micro font-medium text-fg-subtle uppercase">{weekday.format(dateOf(date))}</span>
              <span
                className={cn(
                  'figures inline-flex h-6 min-w-6 items-center justify-center rounded-pill px-1.5 text-xs',
                  isToday ? 'bg-fg font-medium text-background' : 'text-fg',
                )}
              >
                {dateOf(date).getDate()}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid border-b border-border-subtle" style={columns}>
        <span className="pt-[11px] pr-2 pl-3 text-micro text-fg-subtle">{allDayLabel}</span>
        {days.map((date) => (
          <AllDayCell
            key={date}
            date={date}
            label={longDay.format(dateOf(date))}
            entries={allDay(date)}
            onOpen={onOpenEntry}
          />
        ))}
      </div>
      <div className="grid" style={{ ...columns, height: (END_HOUR - START_HOUR) * hourHeight }}>
        <div className="relative">
          {hours.map((hour) => (
            <span
              key={hour}
              style={{ top: (hour - START_HOUR) * hourHeight }}
              className="figures absolute right-2 -translate-y-1/2 text-micro text-fg-subtle"
            >
              {timeOf(hour * 60)}
            </span>
          ))}
        </div>
        {days.map((date) => {
          const label = longDay.format(dateOf(date));
          const showNow =
            date === today && nowMinutes !== null && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;
          return (
            <div key={date} data-slot="agenda-day" className="relative min-w-0 border-l border-border-subtle">
              {slots.map((minutes) => (
                <Slot
                  key={minutes}
                  date={date}
                  minutes={minutes}
                  label={label}
                  hourHeight={hourHeight}
                  onAdd={onAddSlot}
                />
              ))}
              {hours.map((hour) => (
                <span
                  key={hour}
                  aria-hidden
                  style={{ top: (hour - START_HOUR) * hourHeight }}
                  className="pointer-events-none absolute inset-x-0 border-t border-border-subtle"
                />
              ))}
              {place(byDay.get(date) ?? []).map((placed) => (
                <AgendaBlock
                  key={placed.entry.id}
                  placed={placed}
                  hourHeight={hourHeight}
                  compact={days.length > 1}
                  onOpen={onOpenEntry}
                />
              ))}
              {showNow ? (
                <span
                  aria-hidden
                  style={{ top: ((nowMinutes - START_HOUR * 60) / 60) * hourHeight }}
                  className="pointer-events-none absolute inset-x-0 z-3 border-t-[1.5px] border-fg"
                >
                  <span className="absolute -top-[4.5px] -left-1 size-[7px] rounded-pill bg-fg" />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { AgendaCalendar, agendaSlot, agendaSlotId };
export type { AgendaEntryData };
