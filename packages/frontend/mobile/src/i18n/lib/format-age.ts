import type { TFunction } from 'i18next';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * "5m", "3h", "2d" — how long ago, in its one largest unit and the
 * `common.relative.*` words the console's compact ages use, so a session's
 * age reads the same on the phone; `common.relative.now` under a minute. It
 * turns into days after a day, as the console's ages do.
 */
export function formatAge(date: Date, now: number, t: TFunction): string {
  const ms = now - date.getTime();
  if (ms < MINUTE) return t('common.relative.now');
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return t('common.relative.minute', { count: minutes });
  const hours = Math.round(ms / HOUR);
  if (hours < 24) return t('common.relative.hour', { count: hours });
  return t('common.relative.day', { count: Math.round(hours / 24) });
}
