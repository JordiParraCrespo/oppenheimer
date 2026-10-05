'use client';

import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import * as React from 'react';

import { dateFormat, dateOf, type IsoDate, shiftMonth } from '../internal/month';
import { DayNumber, MonthGrid } from '../internal/month-grid';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Chip } from './chip';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

/**
 * DatePicker — a due date, or a day for an event: a 34px trigger with the
 * calendar glyph, the day ("Sat, Oct 10") and a chevron, opening a small
 * month: today ringed, the picked day filled in ink, the days of the
 * months around it muted. Under the grid, quick picks as chips (Today,
 * Tomorrow, Next Monday: the caller's words and days) and Clear when a day
 * is set. Picking a day closes it.
 *
 * Days are ISO strings in the reader's calendar (`YYYY-MM-DD`); `today` is
 * the caller's clock, so nothing reads one in render.
 */
function DatePicker({
  value,
  onValueChange,
  today,
  locale = 'en',
  placeholder,
  quick,
  labels = {},
  className,
}: {
  value: IsoDate | null;
  onValueChange: (value: IsoDate | null) => void;
  today: IsoDate;
  locale?: string;
  /** The trigger's words with no day ("Add a date"). */
  placeholder?: string;
  quick?: readonly { label: string; value: IsoDate }[];
  labels?: { choose?: string; previous?: string; next?: string; clear?: string };
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const start = dateOf(value ?? today);
  const [view, setView] = React.useState({ year: start.getFullYear(), month: start.getMonth() });
  const title = dateFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(view.year, view.month, 1),
  );
  const label = value
    ? dateFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(dateOf(value))
    : placeholder;

  const pick = (iso: IsoDate | null) => {
    onValueChange(iso);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const shown = dateOf(value ?? today);
          setView({ year: shown.getFullYear(), month: shown.getMonth() });
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger
        aria-haspopup="dialog"
        data-slot="date-picker"
        className={cn(
          'flex h-(--control-h-sm) min-w-[184px] items-center gap-2 rounded-sm border border-border bg-card pr-2.5 pl-2.5 text-left text-sm text-fg outline-none transition-[border-color,box-shadow] duration-fast ease-standard hover:border-fg-subtle focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring data-popup-open:border-primary data-popup-open:ring-3 data-popup-open:ring-ring',
          className,
        )}
      >
        <CalendarIcon className="size-3.5 shrink-0 text-fg-muted" aria-hidden />
        <span className={cn('min-w-0 flex-1 truncate', !value && 'text-fg-subtle')}>{label}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={labels.choose ?? 'Choose a date'}
        className="w-70 gap-0 rounded-md border-0 p-3 shadow-popover"
      >
        <div className="flex items-center gap-1 pb-2 pl-1.5">
          <span className="flex-1 text-sm font-medium text-fg">{title}</span>
          <MonthStep label={labels.previous ?? 'Previous month'} onClick={() => setView(shiftMonth(view.year, view.month, -1))}>
            <ChevronLeftIcon className="size-[15px]" aria-hidden />
          </MonthStep>
          <MonthStep label={labels.next ?? 'Next month'} onClick={() => setView(shiftMonth(view.year, view.month, 1))}>
            <ChevronRightIcon className="size-[15px]" aria-hidden />
          </MonthStep>
        </div>
        <MonthGrid year={view.year} month={view.month} locale={locale} face="picker">
          {(day) => {
            const selected = day.iso === value;
            return (
              <button
                key={day.iso}
                type="button"
                aria-pressed={selected}
                onClick={() => pick(day.iso)}
                className="group/day mx-auto rounded-pill outline-none focus-visible:outline-2 focus-visible:outline-ring"
              >
                <DayNumber
                  day={day}
                  face="picker"
                  today={day.iso === today}
                  selected={selected}
                  className={cn('transition-colors duration-instant ease-standard', !selected && 'group-hover/day:bg-hover-surface')}
                />
              </button>
            );
          }}
        </MonthGrid>
        {quick?.length || value ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border-subtle pt-2.5">
            {quick?.map((option) => (
              <Chip
                key={option.label}
                variant="solid"
                selected={option.value === value}
                onClick={() => pick(option.value)}
              >
                {option.label}
              </Chip>
            ))}
            <span className="flex-1" />
            {value ? (
              <Button variant="ghost" size="sm" onClick={() => pick(null)}>
                {labels.clear ?? 'Clear'}
              </Button>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function MonthStep({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-(--control-h-sm) items-center justify-center rounded-pill text-fg-muted outline-none transition-colors duration-instant ease-standard hover:bg-hover-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}

export { DatePicker };
