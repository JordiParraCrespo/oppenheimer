/** Calendar-day arithmetic on `YYYY-MM-DD`, in no timezone: a day is a day. */

function parts(iso: string): [number, number, number] {
  const [year, month, day] = iso.split('-').map(Number);
  return [year, month, day];
}

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `iso` plus `days` (negative goes back). */
export function addDays(iso: string, days: number): string {
  const [year, month, day] = parts(iso);
  return isoOf(new Date(Date.UTC(year, month - 1, day + days)));
}

/** Monday 0 … Sunday 6. */
export function weekdayOf(iso: string): number {
  const [year, month, day] = parts(iso);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/** The `YYYY-MM` a day is in. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** The first of the month `months` after `YYYY-MM`. */
export function shiftMonth(month: string, months: number): string {
  const [year, m] = month.split('-').map(Number);
  return isoOf(new Date(Date.UTC(year, m - 1 + months, 1))).slice(0, 7);
}

/**
 * The days a month grid draws: whole weeks, Monday first, from the Monday on or
 * before the 1st to the Sunday on or after the last.
 */
export function monthGridDays(month: string): string[] {
  const first = `${month}-01`;
  const start = addDays(first, -weekdayOf(first));
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const end = addDays(last, 6 - weekdayOf(last));
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Today in the viewer's own timezone, as a calendar day. */
export function todayIn(now: number): string {
  const date = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from `from` to `to`: 1 for tomorrow, -1 for yesterday. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
