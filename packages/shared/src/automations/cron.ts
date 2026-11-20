/**
 * Cron expressions: the five fields (minute, hour, day of month, month, day of
 * week) a `cron` schedule stores, parsed into sets, and described as words.
 *
 * The zone is the schedule's own and the walk from one instant to the next is
 * `nextScheduleOccurrence` in `schedule.ts`, which keeps the daylight-saving
 * rules every frequency follows. This file knows no zone.
 *
 * Beyond the classic syntax (`*`, lists, ranges, steps, `JAN`/`MON` names, 7 as
 * Sunday) it reads the three extensions a routine needs and five fields cannot
 * otherwise say:
 * - `L` in the day of month: the last day of the month;
 * - `LW` in the day of month: the last weekday (Monday to Friday) of the month;
 * - `2#2` in the day of week: the second Tuesday of the month (`#1` to `#5`);
 * - `5L` in the day of week: the last Friday of the month.
 *
 * When both day fields are restricted, a day matching either fires, as in
 * every cron since Vixie's: `0 9 1 * 1` is the 1st and every Monday. A field
 * written from `*` (`*\/2`) counts as unrestricted for that rule, as it does
 * there, so `0 9 *\/2 * 1` is a Monday on an odd day.
 */

/**
 * The shortest wait between two firings, in minutes: no two minutes of the
 * hour closer than this, counting the wrap from :55 to the next hour's :00.
 */
export const CRON_MIN_GAP_MINUTES = 5;

/** Longer than any expression worth writing; the schema refuses past it. */
export const CRON_EXPRESSION_MAX = 100;

export type CronDayOfMonth =
  | { kind: 'any' }
  /** `starred`: written from `*`, so it narrows the other day field instead of adding to it. */
  | { kind: 'days'; days: readonly number[]; starred: boolean }
  | { kind: 'last' }
  | { kind: 'lastWeekday' };

export type CronDayOfWeek =
  | { kind: 'any' }
  | { kind: 'days'; days: readonly number[]; starred: boolean }
  | { kind: 'nth'; day: number; nth: number }
  | { kind: 'last'; day: number };

/** A parsed expression: each field as the sorted values it allows. */
export interface CronSpec {
  readonly minutes: readonly number[];
  readonly hours: readonly number[];
  readonly dayOfMonth: CronDayOfMonth;
  /** 1–12. */
  readonly months: readonly number[];
  readonly dayOfWeek: CronDayOfWeek;
}

const MONTH_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function range(from: number, to: number, step = 1): number[] {
  const values: number[] = [];
  for (let value = from; value <= to; value += step) values.push(value);
  return values;
}

function readNumber(token: string, names: readonly string[] | null, offset: number): number | null {
  if (/^\d{1,2}$/.test(token)) return Number(token);
  const index = names?.indexOf(token.toUpperCase()) ?? -1;
  return index >= 0 ? index + offset : null;
}

/**
 * One numeric field: a comma list of `*`, `n`, `a-b`, each with an optional
 * `/step` (`5/15` runs from 5 to the field's end). Null when any part is out
 * of range or unreadable.
 */
function parseField(
  field: string,
  min: number,
  max: number,
  names: readonly string[] | null = null,
  nameOffset = 0,
  wrap?: { from: number; to: number },
): number[] | null {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const match = /^([^/]+)(?:\/(\d{1,2}))?$/.exec(part);
    if (!match) return null;
    const [, base, stepText] = match;
    const step = stepText === undefined ? 1 : Number(stepText);
    if (step < 1) return null;
    let from: number | null;
    let to: number | null;
    if (base === '*') {
      from = min;
      to = max;
    } else {
      const bounds = base.split('-');
      if (bounds.length > 2) return null;
      from = readNumber(bounds[0], names, nameOffset);
      to = bounds.length === 2 ? readNumber(bounds[1], names, nameOffset) : stepText ? max : from;
    }
    if (from === null || to === null) return null;
    const top = wrap && to === wrap.from ? max + 1 : max;
    if (from < min || to > top || from > to) return null;
    for (const value of range(from, to, step)) {
      values.add(wrap && value === wrap.from ? wrap.to : value);
    }
  }
  return [...values].sort((a, b) => a - b);
}

function parseDayOfMonth(field: string): CronDayOfMonth | null {
  if (field === '*' || field === '?') return { kind: 'any' };
  const upper = field.toUpperCase();
  if (upper === 'L') return { kind: 'last' };
  if (upper === 'LW') return { kind: 'lastWeekday' };
  const days = parseField(field, 1, 31);
  return days ? { kind: 'days', days, starred: field.startsWith('*') } : null;
}

function parseDayOfWeek(field: string): CronDayOfWeek | null {
  if (field === '*' || field === '?') return { kind: 'any' };
  const nth = /^([A-Za-z]{3}|[0-7])#([1-5])$/.exec(field);
  if (nth) {
    const day = readNumber(nth[1], WEEKDAY_NAMES, 0);
    return day === null || day > 7 ? null : { kind: 'nth', day: day % 7, nth: Number(nth[2]) };
  }
  const last = /^([A-Za-z]{3}|[0-7])L$/i.exec(field);
  if (last) {
    const day = readNumber(last[1], WEEKDAY_NAMES, 0);
    return day === null || day > 7 ? null : { kind: 'last', day: day % 7 };
  }
  // 7 is Sunday too; a range may end on it (`5-7`).
  const days = parseField(field, 0, 6, WEEKDAY_NAMES, 0, { from: 7, to: 0 });
  return days
    ? {
        kind: 'days',
        days: [...new Set(days)].sort((a, b) => a - b),
        starred: field.startsWith('*'),
      }
    : null;
}

/** The expression as sets, or null when it is not five readable fields. */
export function parseCron(expression: string): CronSpec | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const minutes = parseField(fields[0], 0, 59);
  const hours = parseField(fields[1], 0, 23);
  const dayOfMonth = parseDayOfMonth(fields[2]);
  const months = parseField(fields[3], 1, 12, MONTH_NAMES, 1);
  const dayOfWeek = parseDayOfWeek(fields[4]);
  if (!minutes || !hours || !dayOfMonth || !months || !dayOfWeek) return null;
  return { minutes, hours, dayOfMonth, months, dayOfWeek };
}

/** Why an expression is refused, or null when a schedule may store it. */
export function cronProblem(expression: string): 'invalid' | 'too_often' | null {
  const spec = parseCron(expression);
  if (!spec) return 'invalid';
  const { minutes, hours } = spec;
  const gaps = minutes.slice(1).map((minute, index) => minute - minutes[index]);
  // The wrap from the hour's last minute to the next hour's first is a gap
  // only when the next hour fires too (23 rolls into 0).
  if (hours.some((hour) => hours.includes((hour + 1) % 24))) {
    gaps.push(minutes[0] + 60 - minutes[minutes.length - 1]);
  }
  return gaps.some((gap) => gap < CRON_MIN_GAP_MINUTES) ? 'too_often' : null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekdayOn(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function lastWeekdayOf(year: number, month: number): number {
  let day = daysInMonth(year, month);
  while (weekdayOn(year, month, day) === 0 || weekdayOn(year, month, day) === 6) day -= 1;
  return day;
}

/** Whether a calendar day is one the expression fires on. */
export function cronDayMatches(spec: CronSpec, year: number, month: number, day: number): boolean {
  if (!spec.months.includes(month)) return false;
  const { dayOfMonth, dayOfWeek } = spec;
  const weekday = weekdayOn(year, month, day);
  const length = daysInMonth(year, month);
  const monthMatch =
    dayOfMonth.kind === 'any' ||
    (dayOfMonth.kind === 'days' && dayOfMonth.days.includes(day)) ||
    (dayOfMonth.kind === 'last' && day === length) ||
    (dayOfMonth.kind === 'lastWeekday' && day === lastWeekdayOf(year, month));
  const weekMatch =
    dayOfWeek.kind === 'any' ||
    (dayOfWeek.kind === 'days' && dayOfWeek.days.includes(weekday)) ||
    (dayOfWeek.kind === 'nth' &&
      weekday === dayOfWeek.day &&
      Math.ceil(day / 7) === dayOfWeek.nth) ||
    (dayOfWeek.kind === 'last' && weekday === dayOfWeek.day && day + 7 > length);
  return bothNarrow(spec) ? monthMatch && weekMatch : monthMatch || weekMatch;
}

/** Whether a day must match both day fields; otherwise either one is enough. */
function bothNarrow({ dayOfMonth, dayOfWeek }: CronSpec): boolean {
  return (
    dayOfMonth.kind === 'any' ||
    dayOfWeek.kind === 'any' ||
    (dayOfMonth.kind === 'days' && dayOfMonth.starred) ||
    (dayOfWeek.kind === 'days' && dayOfWeek.starred)
  );
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export interface CronClock {
  readonly hour: number;
  readonly minute: number;
}

/**
 * When in the day an expression fires, as the sentence says it:
 * - `at`: a few times, listed (09:00, 13:00 and 18:00);
 * - `everyMinutes`: every 15 minutes, within `from`–`to` when not all day;
 * - `everyHours`: every hour (or every 2) at one minute, within `from`–`to`
 *   when not all day from midnight;
 * - `minutesPast`: anything else, as the minutes past the hours it names.
 */
export type CronTimeWords =
  | { kind: 'at'; times: readonly CronClock[] }
  | { kind: 'everyMinutes'; step: number; from?: CronClock; to?: CronClock }
  | { kind: 'everyHours'; step: number; minute: number; from?: CronClock; to?: CronClock }
  | { kind: 'minutesPast'; minutes: readonly number[]; hours: readonly number[] | null };

/** Which days, as the sentence says them; `either` is both day fields restricted. */
export type CronDayWords =
  | { kind: 'everyDay' }
  | { kind: 'weekDays'; days: readonly number[] }
  | { kind: 'monthDays'; days: readonly number[] }
  | { kind: 'lastDay' }
  | { kind: 'lastWeekday' }
  | { kind: 'nthWeekday'; day: number; nth: number }
  | { kind: 'lastWeekdayOf'; day: number }
  | { kind: 'either'; monthDays: CronDayWords; weekDays: CronDayWords }
  | { kind: 'both'; monthDays: CronDayWords; weekDays: CronDayWords };

export interface CronWords {
  readonly time: CronTimeWords;
  readonly day: CronDayWords;
  /** 1–12, or null for every month. */
  readonly months: readonly number[] | null;
}

/** The most times `at` lists before the sentence says them another way. */
const AT_MAX = 6;

/** The step of an arithmetic run of two or more values, or null. */
function stepOf(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const step = values[1] - values[0];
  return values.every((value, index) => value === values[0] + index * step) ? step : null;
}

/**
 * Whether a step run keeps its step across the field's wrap too, so "every
 * step" is true without a gap: `*\/15` does (:45 to the next :00), `*\/25`
 * does not (:50 to the next :00 is ten minutes).
 */
function stepsThroughWrap(values: readonly number[], step: number, size: number): boolean {
  return values[0] + size - values[values.length - 1] === step;
}

function timeWords(spec: CronSpec): CronTimeWords {
  const { minutes, hours } = spec;
  if (minutes.length * hours.length <= AT_MAX) {
    return {
      kind: 'at',
      times: hours.flatMap((hour) => minutes.map((minute) => ({ hour, minute }))),
    };
  }
  const allDay = hours.length === 24;
  const hourStep = hours.length === 1 ? 1 : stepOf(hours);
  const first = { hour: hours[0], minute: minutes[0] };
  const last = { hour: hours[hours.length - 1], minute: minutes[minutes.length - 1] };
  const minuteStep = stepOf(minutes);
  if (minuteStep && stepsThroughWrap(minutes, minuteStep, 60) && (allDay || hourStep === 1)) {
    return allDay && minutes[0] === 0
      ? { kind: 'everyMinutes', step: minuteStep }
      : { kind: 'everyMinutes', step: minuteStep, from: first, to: last };
  }
  if (minutes.length === 1 && hourStep) {
    const whole = stepsThroughWrap(hours, hourStep, 24) && hours[0] === 0;
    return whole
      ? { kind: 'everyHours', step: hourStep, minute: minutes[0] }
      : { kind: 'everyHours', step: hourStep, minute: minutes[0], from: first, to: last };
  }
  return { kind: 'minutesPast', minutes, hours: allDay ? null : hours };
}

function monthDayWords(dayOfMonth: Exclude<CronDayOfMonth, { kind: 'any' }>): CronDayWords {
  if (dayOfMonth.kind === 'last') return { kind: 'lastDay' };
  if (dayOfMonth.kind === 'lastWeekday') return { kind: 'lastWeekday' };
  return { kind: 'monthDays', days: dayOfMonth.days };
}

function weekDayWords(dayOfWeek: Exclude<CronDayOfWeek, { kind: 'any' }>): CronDayWords {
  if (dayOfWeek.kind === 'nth')
    return { kind: 'nthWeekday', day: dayOfWeek.day, nth: dayOfWeek.nth };
  if (dayOfWeek.kind === 'last') return { kind: 'lastWeekdayOf', day: dayOfWeek.day };
  return dayOfWeek.days.length === 7
    ? { kind: 'everyDay' }
    : { kind: 'weekDays', days: dayOfWeek.days };
}

function dayWords(spec: CronSpec): CronDayWords {
  const { dayOfMonth, dayOfWeek } = spec;
  if (dayOfMonth.kind === 'any' && dayOfWeek.kind === 'any') return { kind: 'everyDay' };
  if (dayOfMonth.kind === 'any')
    return weekDayWords(dayOfWeek as Exclude<CronDayOfWeek, { kind: 'any' }>);
  const monthDays = monthDayWords(dayOfMonth);
  if (dayOfWeek.kind === 'any') return monthDays;
  const weekDays = weekDayWords(dayOfWeek);
  return bothNarrow(spec)
    ? { kind: 'both', monthDays, weekDays }
    : { kind: 'either', monthDays, weekDays };
}

/**
 * An expression as the parts of a sentence, for the console (in the reader's
 * language) and the API (in English) to put into words. Null when it does not
 * parse.
 */
export function describeCron(expression: string): CronWords | null {
  const spec = parseCron(expression);
  if (!spec) return null;
  return {
    time: timeWords(spec),
    day: dayWords(spec),
    months: spec.months.length === 12 ? null : spec.months,
  };
}

// ---------------------------------------------------------------------------
// English, for the API's bot tools and approval cards
// ---------------------------------------------------------------------------

const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const ORDINALS_EN = ['first', 'second', 'third', 'fourth', 'fifth'];

function clock({ hour, minute }: CronClock): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function listEn(items: readonly string[], joiner = 'and'): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${joiner} ${items[items.length - 1]}`;
}

function span(from?: CronClock, to?: CronClock): string {
  return from && to ? ` from ${clock(from)} to ${clock(to)}` : '';
}

function timeEn(time: CronTimeWords): string {
  switch (time.kind) {
    case 'at':
      return `at ${listEn(time.times.map(clock))}`;
    case 'everyMinutes':
      return `every ${time.step} minutes${span(time.from, time.to)}`;
    case 'everyHours': {
      const every = time.step === 1 ? 'every hour' : `every ${time.step} hours`;
      return `${every} at :${String(time.minute).padStart(2, '0')}${span(time.from, time.to)}`;
    }
    case 'minutesPast': {
      const minutes = listEn(time.minutes.map((minute) => `:${String(minute).padStart(2, '0')}`));
      return time.hours
        ? `at ${minutes} past ${listEn(time.hours.map((hour) => `${String(hour).padStart(2, '0')}h`))}`
        : `every hour at ${minutes}`;
    }
  }
}

function dayEn(day: CronDayWords): string {
  switch (day.kind) {
    case 'everyDay':
      return 'every day';
    case 'weekDays': {
      const key = day.days.join(',');
      if (key === '1,2,3,4,5') return 'Monday to Friday';
      if (key === '0,6') return 'on weekends';
      return `on ${listEn(day.days.map((weekday) => WEEKDAYS_EN[weekday]))}`;
    }
    case 'monthDays':
      return `on day ${listEn(day.days.map(String))} of the month`;
    case 'lastDay':
      return 'on the last day of the month';
    case 'lastWeekday':
      return 'on the last weekday of the month';
    case 'nthWeekday':
      return `on the ${ORDINALS_EN[day.nth - 1]} ${WEEKDAYS_EN[day.day]} of the month`;
    case 'lastWeekdayOf':
      return `on the last ${WEEKDAYS_EN[day.day]} of the month`;
    case 'either':
      return `${dayEn(day.monthDays)} or ${dayEn(day.weekDays)}`;
    case 'both':
      return `${dayEn(day.monthDays)}, if that falls ${fallsEn(day.weekDays)}`;
  }
}

/** The day-of-week half of a `both`, as what the day must fall on. */
function fallsEn(day: CronDayWords): string {
  if (day.kind !== 'weekDays') return dayEn(day);
  const key = day.days.join(',');
  if (key === '1,2,3,4,5') return 'on a weekday';
  if (key === '0,6') return 'on a weekend';
  return `on a ${listEn(
    day.days.map((weekday) => WEEKDAYS_EN[weekday]),
    'or',
  )}`;
}

/** "Every 15 minutes from 09:00 to 17:45, Monday to Friday", or null when it does not parse. */
export function cronToEnglish(expression: string): string | null {
  const words = describeCron(expression);
  if (!words) return null;
  const months = words.months
    ? `, in ${listEn(words.months.map((month) => MONTHS_EN[month - 1]))}`
    : '';
  const sentence = `${timeEn(words.time)}, ${dayEn(words.day)}${months}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
