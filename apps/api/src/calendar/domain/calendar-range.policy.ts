import { CALENDAR_RANGE_MAX_DAYS } from '@oppenheimer/shared';

/** Days from `from` to `to`, both `YYYY-MM-DD`, both included. */
export function daysInRange(from: string, to: string): number {
  return (
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  );
}

/** Whether one read may cover the range: forwards, and no wider than a month view needs. */
export function isReadableRange(from: string, to: string): boolean {
  const days = daysInRange(from, to);
  return days >= 1 && days <= CALENDAR_RANGE_MAX_DAYS;
}

/** An event's times fit its day: all day with none, or a start and a later end. */
export function timesFitTheDay(times: {
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
}): boolean {
  if (times.allDay) return true;
  return Boolean(times.startTime && times.endTime && times.endTime > times.startTime);
}
