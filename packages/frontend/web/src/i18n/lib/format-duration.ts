import type { TFunction } from 'i18next';

/**
 * Durations, as the console prints them. A countdown is a clock of several
 * fields, and its units come from `Intl.NumberFormat`'s narrow unit style, so
 * the reader's locale writes them ("5m" in English, "5min" in Spanish);
 * `Intl.DurationFormat` would do the joining too, but it is not in every
 * browser the console supports yet. A duration in one unit is an age or a
 * wait, and goes through `common.relative.*` like every other age.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type Unit = 'day' | 'hour' | 'minute' | 'second';

/** One formatter per (locale, unit, padding): they are pure and costly to build. */
const unitCache = new Map<string, Intl.NumberFormat>();

function unit(locale: string, name: Unit, value: number, padded = false): string {
  const key = `${locale}|${name}|${padded}`;
  let formatter = unitCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: name,
      unitDisplay: 'narrow',
      minimumIntegerDigits: padded ? 2 : 1,
    });
    unitCache.set(key, formatter);
  }
  return formatter.format(value);
}

/**
 * A countdown, to the second while it is under a day: "14h 56m 54s",
 * "2d 3h 05m", "4m 07s". The trailing fields are padded so the line keeps its
 * width as it ticks.
 */
export function formatCountdown(ms: number, locale: string): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (days) {
    return [
      unit(locale, 'day', days),
      unit(locale, 'hour', hours),
      unit(locale, 'minute', minutes, true),
    ].join(' ');
  }
  if (hours) {
    return [
      unit(locale, 'hour', hours),
      unit(locale, 'minute', minutes, true),
      unit(locale, 'second', rest, true),
    ].join(' ');
  }
  return [unit(locale, 'minute', minutes), unit(locale, 'second', rest, true)].join(' ');
}

/**
 * How long something has been gone, in its two largest units, the way the
 * host-link frames write it: "7s", "2m 14s", "1h 03m", "2d 3h". Unlike a
 * countdown it does not hold its width: under a minute it is seconds alone.
 */
export function formatTimeAway(ms: number, locale: string): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (days) return [unit(locale, 'day', days), unit(locale, 'hour', hours)].join(' ');
  if (hours) return [unit(locale, 'hour', hours), unit(locale, 'minute', minutes, true)].join(' ');
  if (minutes) return [unit(locale, 'minute', minutes), unit(locale, 'second', rest)].join(' ');
  return unit(locale, 'second', rest);
}

/**
 * Where a compact duration switches from hours to days, by what it measures:
 * an age turns into days after a day ("2d ago"); a wait the reader plans
 * around keeps its hours for two ("in 45h", the automations sidebar's frame).
 */
const DAYS_FROM_HOURS = { age: 24, wait: 48 } as const;

/**
 * A duration in its one largest unit: "45m", "3h", "2d", at least a minute —
 * in the `common.relative.*` words, the one place the console's compact ages
 * are written, so a wait and an age read the same.
 */
export function formatShortDuration(
  ms: number,
  t: TFunction,
  kind: keyof typeof DAYS_FROM_HOURS = 'age',
): string {
  const daysFrom = DAYS_FROM_HOURS[kind];
  const minutes = Math.max(1, Math.round(ms / MINUTE));
  if (minutes < 60) return t('common.relative.minute', { count: minutes });
  const hours = Math.round(ms / HOUR);
  if (hours < daysFrom) return t('common.relative.hour', { count: hours });
  return t('common.relative.day', { count: Math.round(hours / 24) });
}

/**
 * A duration as a stopwatch: `mm:ss` while a start is plausible, `h:mm:ss`
 * past the hour, so a session that has been "starting" since yesterday reads
 * as the problem it is rather than as `99:12`. Digits and colons only, the
 * same in every locale. It never runs backwards: a clock read a moment before
 * the row it measures was written counts from zero.
 */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const pad = (value: number) => String(value).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
