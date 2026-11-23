import type { ScheduleFrequency } from './catalog.js';
import { type CronSpec, cronDayMatches, parseCron } from './cron.js';

/**
 * A schedule rule and the arithmetic that turns it into instants.
 *
 * A schedule is a **wall-clock rule plus an IANA timezone**, never a UTC time:
 * "daily at 09:00 in Madrid" is 07:00 UTC in summer and 08:00 in winter, and
 * storing either would drift by an hour twice a year. The API stores the rule
 * and the next instant it fires (`nextFireAt`, UTC); this file computes that
 * instant.
 *
 * It lives in the shared package, and uses only `Intl`, so the console's "Next
 * run · in 2d 3h" and the API's scheduler compute the same answer from the same
 * code, in a browser and in Node, with no timezone library in either bundle.
 *
 * Daylight-saving transitions follow Temporal's `compatible` disambiguation,
 * which is what cron implementations and calendars do:
 * - a wall time that does not exist (02:30 on the spring-forward night) fires
 *   as though the clock had not jumped — at 03:30;
 * - a wall time that happens twice (02:30 on the fall-back night) fires once,
 *   at its first occurrence.
 */
export interface ScheduleRule {
  readonly frequency: ScheduleFrequency;
  /** 0–23, local. Ignored by `hourly`. */
  readonly hour: number;
  /** 0–59, local. */
  readonly minute: number;
  /** `weekly` only: days of the week, 0 = Sunday … 6 = Saturday. */
  readonly days?: readonly number[];
  /** `monthly` only: 1–28. */
  readonly dayOfMonth?: number;
  /** `once` only: the local calendar date, `YYYY-MM-DD`. */
  readonly date?: string;
  /** `cron` only: the five fields (`cron.ts`), read in `timezone`. `hour` and `minute` are ignored. */
  readonly expression?: string;
  /** An IANA zone, such as `Europe/Madrid`. */
  readonly timezone: string;
}

export interface WallTime {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

/** Whether the runtime knows the zone. Invalid zones are refused at the route. */
export function isValidTimeZone(timezone: string): boolean {
  if (!timezone) return false;
  try {
    formatterFor(timezone);
    return true;
  } catch {
    return false;
  }
}

/** The wall time an instant shows in a zone, to the minute. */
export function wallTimeAt(instant: number, timezone: string): WallTime {
  const parts = formatterFor(timezone).formatToParts(new Date(instant));
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
  };
}

/** A wall time read as if it were UTC, which is what offsets are measured against. */
function wallAsUtc(wall: WallTime): number {
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
}

/** The zone's offset from UTC at an instant, in milliseconds (east positive). */
function offsetAt(instant: number, timezone: string): number {
  const floored = Math.floor(instant / MINUTE) * MINUTE;
  return wallAsUtc(wallTimeAt(floored, timezone)) - floored;
}

/**
 * The instant a wall time happens in a zone, with Temporal's `compatible`
 * disambiguation (see the file comment). Offsets are sampled twelve hours
 * either side, which no zone's transitions come closer than.
 */
export function zonedWallTimeToInstant(wall: WallTime, timezone: string): number {
  const local = wallAsUtc(wall);
  const before = offsetAt(local - 12 * HOUR, timezone);
  const after = offsetAt(local + 12 * HOUR, timezone);
  const candidates = [...new Set([local - before, local - after])];
  const valid = candidates.filter((instant) => wallAsUtc(wallTimeAt(instant, timezone)) === local);
  if (valid.length > 0) return Math.min(...valid);
  // A gap: the wall time was skipped. Using the offset from before the jump
  // lands the same distance past it, which is the `compatible` answer.
  return local - before;
}

/** The calendar day `offset` days from a wall date, normalised through UTC arithmetic. */
function addDays(wall: WallTime, offset: number): WallTime {
  const shifted = new Date(Date.UTC(wall.year, wall.month - 1, wall.day) + offset * DAY);
  return {
    ...wall,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function weekdayOf(wall: WallTime): number {
  return new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
}

function dayQualifies(rule: ScheduleRule, wall: WallTime): boolean {
  switch (rule.frequency) {
    case 'daily':
      return true;
    case 'weekdays': {
      const weekday = weekdayOf(wall);
      return weekday >= 1 && weekday <= 5;
    }
    case 'weekly':
      return (rule.days ?? []).includes(weekdayOf(wall));
    case 'monthly':
      return wall.day === rule.dayOfMonth;
    default:
      return false;
  }
}

function parseDate(value: string | undefined): Pick<WallTime, 'year' | 'month' | 'day'> | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/**
 * The first instant strictly after `after` at which the rule fires, or `null`
 * when it never will again (a `once` in the past, or a rule with nothing to
 * fire on, such as `weekly` with no days).
 */
export function nextScheduleOccurrence(rule: ScheduleRule, after: Date): Date | null {
  const afterMs = after.getTime();
  const { timezone } = rule;

  if (rule.frequency === 'once') {
    const date = parseDate(rule.date);
    if (!date) return null;
    const instant = zonedWallTimeToInstant(
      { ...date, hour: rule.hour, minute: rule.minute },
      timezone,
    );
    return instant > afterMs ? new Date(instant) : null;
  }

  if (rule.frequency === 'cron') {
    const spec = parseCron(rule.expression ?? '');
    if (!spec) return null;
    const instant = nextCronInstant(spec, timezone, afterMs);
    return instant === null ? null : new Date(instant);
  }

  const start = wallTimeAt(afterMs, timezone);

  if (rule.frequency === 'hourly') {
    // Two days of hours is more than any transition can swallow.
    for (let step = 0; step <= 48; step += 1) {
      const hourStart = new Date(
        Date.UTC(start.year, start.month - 1, start.day, start.hour) + step * HOUR,
      );
      const instant = zonedWallTimeToInstant(
        {
          year: hourStart.getUTCFullYear(),
          month: hourStart.getUTCMonth() + 1,
          day: hourStart.getUTCDate(),
          hour: hourStart.getUTCHours(),
          minute: rule.minute,
        },
        timezone,
      );
      if (instant > afterMs) return new Date(instant);
    }
    return null;
  }

  // Daily, weekdays, weekly, monthly: walk calendar days. Sixty-two covers the
  // longest gap between two occurrences of any of them (a monthly rule).
  for (let offset = 0; offset <= 62; offset += 1) {
    const day = addDays(start, offset);
    if (!dayQualifies(rule, day)) continue;
    const instant = zonedWallTimeToInstant(
      { ...day, hour: rule.hour, minute: rule.minute },
      timezone,
    );
    if (instant > afterMs) return new Date(instant);
  }
  return null;
}

/**
 * More than a daylight-saving transition can move a wall time (two hours at
 * most, in any zone): a slot this far before `after` cannot follow it.
 */
const SHIFT_MAX = 3 * HOUR;

/**
 * One Gregorian cycle of days, after which the calendar repeats: a day the
 * walk has not met by then (`0 0 30 2 *`) never comes. Waits really are that
 * long: 29 February on a Sunday comes in 2032 and next in 2060.
 */
const CRON_SEARCH_DAYS = 146_097;

/**
 * The earliest instant after `afterMs` among one calendar day's slots, or
 * null. Each slot goes through `zonedWallTimeToInstant`, so a skipped wall
 * time fires as though the clock had not jumped and a repeated one fires once.
 * A skipped slot can land after a later slot of the same day (02:30 lands at
 * 03:30, after 03:00), so every slot within `SHIFT_MAX` of the first one that
 * follows `afterMs` is weighed, and the earliest instant wins. Slots more than
 * `SHIFT_MAX` before `afterMs`, in wall time, cannot follow it and are skipped.
 */
function earliestSlotOn(
  spec: CronSpec,
  day: WallTime,
  timezone: string,
  afterMs: number,
  floor: number,
): number | null {
  let best: number | null = null;
  let firstLocal: number | null = null;
  for (const hour of spec.hours) {
    for (const minute of spec.minutes) {
      const wall = { ...day, hour, minute };
      const local = wallAsUtc(wall);
      if (local < floor) continue;
      if (firstLocal !== null && local > firstLocal + SHIFT_MAX) return best;
      const instant = zonedWallTimeToInstant(wall, timezone);
      if (instant <= afterMs) continue;
      firstLocal ??= local;
      if (best === null || instant < best) best = instant;
    }
  }
  return best;
}

/**
 * A cron expression's first instant after `afterMs`, walking local calendar
 * days that match. The day after the first one with a slot is read too, since
 * a shift near midnight could carry one of its slots across the day's end.
 */
function nextCronInstant(spec: CronSpec, timezone: string, afterMs: number): number | null {
  const start = wallTimeAt(afterMs, timezone);
  const floor = wallAsUtc(start) - SHIFT_MAX;
  let best: number | null = null;
  let lastDay = CRON_SEARCH_DAYS;
  for (let offset = 0; offset <= lastDay; offset += 1) {
    const day = addDays(start, offset);
    if (!cronDayMatches(spec, day.year, day.month, day.day)) continue;
    const found = earliestSlotOn(spec, day, timezone, afterMs, floor);
    if (found === null) continue;
    if (best === null || found < best) best = found;
    lastDay = Math.min(lastDay, offset + 1);
  }
  return best;
}

/**
 * The zone's short name at an instant (`CEST`, `GMT+2`), for the sentence the
 * editor prints after the time.
 */
export function timeZoneAbbreviation(timezone: string, at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
    .formatToParts(at)
    .find((candidate) => candidate.type === 'timeZoneName');
  return part?.value ?? timezone;
}
