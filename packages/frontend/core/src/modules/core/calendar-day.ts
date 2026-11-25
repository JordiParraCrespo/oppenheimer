/**
 * Calendar days (`YYYY-MM-DD`) in no timezone: a day is a day. What the web
 * and the phone both ask of a due date. The web kit re-exports them.
 */

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

/** `today`, `tomorrow` or `yesterday` for a day next to `today`, so a caller can say it in words. */
export function nearDay(iso: string, today: string): 'today' | 'tomorrow' | 'yesterday' | null {
  const days = daysBetween(today, iso);
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : days === -1 ? 'yesterday' : null;
}
