'use client';

import { CalendarIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import * as React from 'react';

import { dateFormat, dateOf, type IsoDate, shiftMonth } from '../internal/month';
import { MonthGrid } from '../internal/month-grid';
import { cn } from '../lib/utils';
import { Button } from './button';
import { IconButton } from './icon-button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Switch } from './switch';

type DateRange = { from: IsoDate; to: IsoDate };

type DateRangePreset = { id: string; label: string; range: DateRange };

type DateRangePickerLabels = {
  custom: string;
  compare: string;
  done: string;
  previous: string;
  next: string;
  choose: string;
  /** The foot's count, after the range: "30 days". */
  days: (count: number) => string;
};

const DEFAULT_LABELS: DateRangePickerLabels = {
  custom: 'Custom',
  compare: 'Compare with previous period',
  done: 'Done',
  previous: 'Previous month',
  next: 'Next month',
  choose: 'Date range',
  days: (n) => `${n} ${n === 1 ? 'day' : 'days'}`,
};

function daysIn(range: DateRange) {
  return Math.round((+dateOf(range.to) - +dateOf(range.from)) / 864e5) + 1;
}

/**
 * DateRangePicker — the period a page reports on (Plan's Stats). A 34px
 * hairline pill: the calendar glyph, the preset's name in muted ink
 * ("Last 30 days", or Custom), the range in mono, a chevron. It opens a
 * card with the presets on the left (32px rows, the current one ticked)
 * and two months side by side, 32px days on a 224px grid: the range fills
 * the selected wash between its two ends, which take the 10px radius and
 * the ink; today is ringed; days after today are off, since nothing has
 * happened there yet. The foot holds the compare switch, the range's length
 * in mono and Done.
 *
 * The first click on a day starts a range and the second ends it (in either
 * order); the pointer previews the second end. A preset applies at once.
 * Days are ISO strings in the reader's calendar, `today` the caller's clock.
 *
 * ```tsx
 * <DateRangePicker value={range} onValueChange={setRange} presets={presets} today={today}
 *   compare={compare} onCompareChange={setCompare} />
 * ```
 */
function DateRangePicker({
  value,
  onValueChange,
  presets = [],
  today,
  compare,
  onCompareChange,
  locale = 'en',
  labels,
  className,
}: {
  value: DateRange;
  onValueChange: (value: DateRange) => void;
  presets?: readonly DateRangePreset[];
  today: IsoDate;
  /** Present with `onCompareChange`: the foot shows the compare switch. */
  compare?: boolean;
  onCompareChange?: (compare: boolean) => void;
  locale?: string;
  labels?: Partial<DateRangePickerLabels>;
  className?: string;
}) {
  const label = { ...DEFAULT_LABELS, ...labels };
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<IsoDate | null>(null);
  const [pointer, setPointer] = React.useState<IsoDate | null>(null);
  const end = dateOf(value.to);
  const [view, setView] = React.useState(() => shiftMonth(end.getFullYear(), end.getMonth(), -1));

  const preset = presets.find((p) => p.range.from === value.from && p.range.to === value.to);
  const short = dateFormat(locale, { month: 'short', day: 'numeric' });
  const rangeLabel = `${short.format(dateOf(value.from))} – ${short.format(dateOf(value.to))}`;
  const title = dateFormat(locale, { month: 'long', year: 'numeric' });
  const second = shiftMonth(view.year, view.month, 1);
  const todayDate = dateOf(today);
  const atToday = second.year > todayDate.getFullYear() || (second.year === todayDate.getFullYear() && second.month >= todayDate.getMonth());

  // While a range is half picked, the pointer is its other end.
  const shown: DateRange =
    anchor !== null
      ? (() => {
          const other = pointer ?? anchor;
          return other < anchor ? { from: other, to: anchor } : { from: anchor, to: other };
        })()
      : value;

  function pickDay(iso: IsoDate) {
    if (anchor === null) {
      setAnchor(iso);
      setPointer(iso);
      return;
    }
    onValueChange(iso < anchor ? { from: iso, to: anchor } : { from: anchor, to: iso });
    setAnchor(null);
    setPointer(null);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const last = dateOf(value.to);
          setView(shiftMonth(last.getFullYear(), last.getMonth(), -1));
        }
        setAnchor(null);
        setPointer(null);
        setOpen(next);
      }}
    >
      <PopoverTrigger
        aria-haspopup="dialog"
        data-slot="date-range-picker"
        className={cn(
          'inline-flex h-(--control-h-md) shrink-0 items-center gap-2 rounded-pill border border-border-subtle pr-3 pl-3.5 text-[13.5px] whitespace-nowrap text-fg outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface focus-visible:ring-3 focus-visible:ring-ring data-popup-open:bg-hover-surface',
          className,
        )}
      >
        <CalendarIcon className="size-3.5 shrink-0 text-fg-muted" aria-hidden />
        <span className="text-fg-muted">{preset?.label ?? label.custom}</span>
        <span className="figures font-mono text-[12.5px]">{rangeLabel}</span>
        <ChevronDownIcon className="size-3.25 shrink-0 text-fg-subtle" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={label.choose}
        className="w-auto max-w-[calc(100vw-32px)] gap-0 overflow-hidden rounded-md border border-border-subtle bg-card p-0 shadow-popover"
      >
        <div className="flex flex-col sm:flex-row">
          {presets.length > 0 ? (
            <div className="flex flex-none flex-row flex-wrap gap-0.5 border-b border-border-subtle p-2 sm:w-42 sm:flex-col sm:border-r sm:border-b-0">
              {presets.map((p) => {
                const on = p === preset;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      onValueChange(p.range);
                      setAnchor(null);
                      const last = dateOf(p.range.to);
                      setView(shiftMonth(last.getFullYear(), last.getMonth(), -1));
                    }}
                    className={cn(
                      'flex h-8 items-center gap-2 rounded-sm px-2.5 text-left text-[13.5px] text-fg outline-none transition-colors duration-instant hover:bg-hover-surface focus-visible:ring-2 focus-visible:ring-ring',
                      on && 'bg-hover-surface',
                    )}
                  >
                    <span className="flex-1">{p.label}</span>
                    {on ? <CheckIcon className="size-3.25 text-primary" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-3">
            <div className="relative z-1 flex items-center gap-1">
              <IconButton size="sm" aria-label={label.previous} onClick={() => setView(shiftMonth(view.year, view.month, -1))}>
                <ChevronLeftIcon className="size-3.75" />
              </IconButton>
              <span className="flex-1" />
              <IconButton
                size="sm"
                aria-label={label.next}
                disabled={atToday}
                onClick={() => setView(shiftMonth(view.year, view.month, 1))}
              >
                <ChevronRightIcon className="size-3.75" />
              </IconButton>
            </div>
            <div className="-mt-9.5 flex gap-6">
              {[view, second].map((m) => (
                <div key={`${m.year}-${m.month}`} className="flex w-56 flex-col gap-1.5">
                  <span className="flex h-7 items-center justify-center text-[13.5px] font-medium">
                    {title.format(new Date(m.year, m.month, 1))}
                  </span>
                  <MonthGrid year={m.year} month={m.month} locale={locale} face="picker">
                    {(day) => {
                      if (!day.inMonth) return <span key={day.iso} aria-hidden className="h-8" />;
                      const future = day.iso > today;
                      const isEnd = day.iso === shown.from || day.iso === shown.to;
                      const inside = day.iso > shown.from && day.iso < shown.to;
                      return (
                        <button
                          key={day.iso}
                          type="button"
                          disabled={future}
                          aria-pressed={isEnd || inside}
                          onClick={() => pickDay(day.iso)}
                          onMouseEnter={() => anchor !== null && setPointer(day.iso)}
                          className={cn(
                            'figures h-8 font-mono text-[12px] outline-none focus-visible:z-1 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-30',
                            isEnd
                              ? 'rounded-sm bg-fg text-canvas'
                              : inside
                                ? 'bg-selected-surface text-fg'
                                : 'rounded-sm text-fg hover:bg-hover-surface',
                            day.iso === today && !isEnd && 'shadow-[inset_0_0_0_1px_var(--border)]',
                          )}
                        >
                          {day.day}
                        </button>
                      );
                    }}
                  </MonthGrid>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 border-t border-border-subtle py-2.5 pr-3 pl-3.5">
          {onCompareChange ? (
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-fg">
              <Switch size="sm" checked={compare ?? false} onCheckedChange={onCompareChange} />
              {label.compare}
            </label>
          ) : null}
          <span className="flex-1" />
          <span className="figures font-mono text-[12px] text-fg-muted">
            {rangeLabel} · {label.days(daysIn(value))}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
            {label.done}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DateRangePicker };
export type { DateRange, DateRangePickerLabels, DateRangePreset };
