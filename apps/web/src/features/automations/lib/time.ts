import { dateFormatter } from '@oppenheimer/frontend-web';
import { wallTimeAt } from '@oppenheimer/shared/automations';
import type { TFunction } from 'i18next';

/**
 * Time as the automations pages print it. Every instant arrives in UTC and is
 * shown in the viewer's zone; the only wall times that are not the viewer's
 * are a schedule's own, which it keeps in the zone it was set in.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const pad2 = (value: number) => String(value).padStart(2, '0');

/** The viewer's IANA zone, which the history chart's days and a new schedule use. */
export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** "08:30", 24-hour, in the viewer's zone (or the one given). */
export function clock(at: Date, timeZone = viewerTimeZone()): string {
  const wall = wallTimeAt(at.getTime(), timeZone);
  return `${pad2(wall.hour)}:${pad2(wall.minute)}`;
}

/** "08:30" from a schedule's own wall fields. */
export function wallClock(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

export { pad2 };

/** "Sep 28": the runs list's date column and the chart's axis. */
export function monthDay(at: Date, locale: string, timeZone = viewerTimeZone()): string {
  return dateFormatter(locale, { month: 'short', day: 'numeric', timeZone }).format(at);
}

/** "Mon 28 Sep": a day that is neither today nor tomorrow. */
export function weekdayDate(at: Date, locale: string, timeZone = viewerTimeZone()): string {
  return dateFormatter(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(at);
}

/** The `YYYY-MM-DD` local date of an instant in a zone. */
export function localDate(at: number, timeZone: string): string {
  const wall = wallTimeAt(at, timeZone);
  return `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}`;
}

/** Whole local days from `now`'s date to `at`'s: 0 today, 1 tomorrow, -1 yesterday. */
export function dayOffset(at: number, now: number, timeZone: string): number {
  const toUtcMidnight = (instant: number) => {
    const wall = wallTimeAt(instant, timeZone);
    return Date.UTC(wall.year, wall.month - 1, wall.day);
  };
  return Math.round((toUtcMidnight(at) - toUtcMidnight(now)) / DAY);
}

/** The countdown under a next run: "14h 56m 54s", "2d 3h 05m", "4m 07s". */
export function countdown(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (days) return `${days}d ${hours}h ${pad2(minutes)}m`;
  if (hours) return `${hours}h ${pad2(minutes)}m ${pad2(rest)}s`;
  return `${minutes}m ${pad2(rest)}s`;
}

/** The sidebar's short form of a wait: "45m", "3h", "2d". */
export function shortWait(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

/** An age: "now", "5m", "3h", "2d", in the reader's language (`common.relative`). */
export function age(ms: number, t: TFunction): string {
  const minutes = ms / MINUTE;
  if (minutes < 1) return t('common.relative.now');
  if (minutes < 60) return t('common.relative.minute', { count: Math.round(minutes) });
  if (minutes < 1440) return t('common.relative.hour', { count: Math.round(minutes / 60) });
  return t('common.relative.day', { count: Math.round(minutes / 1440) });
}

/** "2h ago" for the trigger preview's matches, "5m ago" under an hour. */
export function agoLong(ms: number): string {
  const hours = ms / HOUR;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
