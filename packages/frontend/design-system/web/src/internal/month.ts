/**
 * Plain-date helpers for the month grids (`MonthCalendar`, `DatePicker`).
 * A day is an ISO date string, `YYYY-MM-DD`, in the reader's own calendar:
 * no time and no zone, so a day never moves when it is formatted.
 */

type IsoDate = string;

function isoOf(date: Date): IsoDate {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function dateOf(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

interface MonthDay {
  iso: IsoDate;
  day: number;
  inMonth: boolean;
}

/**
 * Whole weeks covering a month, Monday first: the days before and after it
 * fill the first and last week, so the grid is always seven wide.
 */
function monthDays(year: number, month: number): MonthDay[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const length = new Date(year, month + 1, 0).getDate();
  const count = Math.ceil((lead + length) / 7) * 7;
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(year, month, 1 - lead + i);
    return { iso: isoOf(date), day: date.getDate(), inMonth: date.getMonth() === month };
  });
}

/** Monday to Sunday in the locale, in the given width. */
function weekdayNames(locale: string, width: 'short' | 'narrow'): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: width });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(2024, 0, 1 + i)));
}

function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const date = new Date(year, month + by, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export { dateOf, isoOf, monthDays, shiftMonth, weekdayNames };
export type { IsoDate, MonthDay };
