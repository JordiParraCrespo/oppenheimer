import type * as React from 'react';

import { cn } from '../lib/utils';
import { type MonthDay, monthDays, weekdayNames } from './month';

/**
 * The one month grid, with two faces: `picker` (`DatePicker`'s small month:
 * narrow weekday letters, 34px round days) and `calendar` (`MonthCalendar`'s
 * card: weekday eyebrows over ruled day cells). Both are whole weeks,
 * Monday first, from `monthDays`; each face draws its own cell through
 * `children`, and `DayNumber` paints the number in either face.
 */
function MonthGrid({
  year,
  month,
  locale,
  face,
  className,
  children,
}: {
  year: number;
  month: number;
  locale: string;
  face: 'picker' | 'calendar';
  className?: string;
  children: (day: MonthDay, position: { index: number; count: number }) => React.ReactNode;
}) {
  const days = monthDays(year, month);
  const weekdays = weekdayNames(locale, face === 'picker' ? 'narrow' : 'short');
  return (
    <div data-slot="month-grid" data-face={face} className={className}>
      <div className={cn('grid grid-cols-7', face === 'picker' ? 'pb-1' : 'border-b border-border-subtle')}>
        {weekdays.map((name, i) => (
          // Narrow names repeat (T, S), so the column is the key.
          // biome-ignore lint/suspicious/noArrayIndexKey: seven fixed columns.
          <span
            key={i}
            className={cn(
              'text-micro text-fg-subtle',
              face === 'picker' ? 'py-1 text-center' : 'px-3 py-2.5 font-medium uppercase',
            )}
          >
            {name}
          </span>
        ))}
      </div>
      <div className={cn('grid grid-cols-7', face === 'picker' && 'gap-y-0.5')}>
        {days.map((day, index) => children(day, { index, count: days.length }))}
      </div>
    </div>
  );
}

/**
 * A day's number. Outside the month it is muted in both faces. In the
 * calendar, today is the filled circle; in the picker, the picked day is
 * filled and today is ringed.
 */
function DayNumber({
  day,
  face,
  today,
  selected = false,
  className,
  children,
}: {
  day: MonthDay;
  face: 'picker' | 'calendar';
  today: boolean;
  selected?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const filled = face === 'calendar' ? today : selected;
  return (
    <span
      className={cn(
        'figures inline-flex items-center justify-center rounded-pill',
        face === 'picker' ? 'size-[34px] text-xs' : 'h-6 min-w-6 px-1.5 text-xs',
        filled ? 'bg-fg font-medium text-background' : day.inMonth ? 'text-fg' : 'text-fg-subtle',
        face === 'picker' && today && !selected && 'shadow-[inset_0_0_0_1.5px_var(--fg-muted)]',
        className,
      )}
    >
      {children ?? day.day}
    </span>
  );
}

export { DayNumber, MonthGrid };
