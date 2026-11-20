import {
  type CronClock,
  type CronDayWords,
  type CronTimeWords,
  describeCron,
  externalEventDefinition,
  type GithubEventType,
  type ScheduleFrequency,
  timeZoneAbbreviation,
} from '@oppenheimer/shared/automations';
import type { TFunction } from 'i18next';
import { dateFormatter, viewerTimeZone, wallClock, weekdayDate } from './format-date';

/**
 * A trigger in words, the way the frames say it: "Weekdays at 08:30",
 * "Every Mon, Wed at 09:00", "On pull request opened", "Any new mail". The words are the
 * locale's; the structure is here once, for the automations pages and a
 * bot's Routines tab alike.
 */

/** The shape the words read: a saved trigger or an editor card. */
export type ScheduleWords = {
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  days?: readonly number[];
  dayOfMonth?: number;
  date?: string;
  expression?: string;
  timezone: string;
};

/** Monday first, the way a week is read. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** "Mon", "Tue"… in the viewer's language, for a 0 = Sunday index. */
export function weekdayName(
  day: number,
  locale: string,
  width: 'long' | 'short' | 'narrow' = 'short',
) {
  // 2023-01-01 was a Sunday; any week would do.
  return dateFormatter(locale, { weekday: width, timeZone: 'UTC' }).format(
    new Date(Date.UTC(2023, 0, 1 + day)),
  );
}

export function daysText(days: readonly number[], locale: string, t: TFunction): string {
  const picked = WEEK_ORDER.filter((day) => days.includes(day));
  const key = picked.join(',');
  if (key === '1,2,3,4,5') return t('automations.trigger.monFri');
  if (key === '6,0') return t('automations.trigger.weekend');
  return picked.map((day) => weekdayName(day, locale)).join(', ');
}

/** A `YYYY-MM-DD` date as "Mon 28 Sep", read as the calendar day it names. */
export function calendarDate(date: string | undefined, locale: string): string {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  return weekdayDate(new Date(Date.UTC(year, month - 1, day, 12)), locale, 'UTC');
}

/**
 * A schedule's own time, and its zone's short name when it is not the
 * viewer's: a rule set in Madrid reads "09:00 CEST" to someone in New York.
 */
function timeText(rule: ScheduleWords): string {
  const time = wallClock(rule.hour, rule.minute);
  return rule.timezone === viewerTimeZone()
    ? time
    : `${time} ${timeZoneAbbreviation(rule.timezone)}`;
}

export function scheduleText(rule: ScheduleWords, locale: string, t: TFunction): string {
  const time = timeText(rule);
  switch (rule.frequency) {
    case 'once':
      return t('automations.trigger.once', { date: calendarDate(rule.date, locale), time });
    case 'hourly':
      return t('automations.trigger.hourly', { minute: String(rule.minute).padStart(2, '0') });
    case 'daily':
      return t('automations.trigger.daily', { time });
    case 'weekdays':
      return t('automations.trigger.weekdays', { time });
    case 'weekly':
      return t('automations.trigger.weekly', { days: daysText(rule.days ?? [], locale, t), time });
    case 'monthly':
      return t('automations.trigger.monthly', { day: rule.dayOfMonth ?? 1, time });
    case 'cron':
      return cronText(rule, locale, t);
  }
}

const listFormats = new Map<string, Intl.ListFormat>();

/** "09:00, 13:00 and 18:00" in the reader's language. */
function listText(items: readonly string[], locale: string): string {
  let format = listFormats.get(locale);
  if (!format) {
    format = new Intl.ListFormat(locale, { type: 'conjunction' });
    listFormats.set(locale, format);
  }
  return format.format(items);
}

function clockText(at: CronClock): string {
  return wallClock(at.hour, at.minute);
}

function cronTimeText(time: CronTimeWords, locale: string, t: TFunction): string {
  const pad = (minute: number) => String(minute).padStart(2, '0');
  const window = 'from' in time && time.from && time.to ? { from: time.from, to: time.to } : null;
  const span = window !== null;
  const bounds = window ? { from: clockText(window.from), to: clockText(window.to) } : {};
  switch (time.kind) {
    case 'at':
      return t('automations.cron.at', { times: listText(time.times.map(clockText), locale) });
    case 'everyMinutes':
      return span
        ? t('automations.cron.everyMinutesWindow', { step: time.step, ...bounds })
        : t('automations.cron.everyMinutes', { step: time.step });
    case 'everyHours': {
      const minute = pad(time.minute);
      if (time.step === 1) {
        return span
          ? t('automations.cron.everyHourWindow', { minute, ...bounds })
          : t('automations.cron.everyHour', { minute });
      }
      return span
        ? t('automations.cron.everyHoursWindow', { step: time.step, minute, ...bounds })
        : t('automations.cron.everyHours', { step: time.step, minute });
    }
    case 'minutesPast': {
      const minutes = listText(
        time.minutes.map((minute) => `:${pad(minute)}`),
        locale,
      );
      return time.hours
        ? t('automations.cron.minutesPast', {
            minutes,
            hours: listText(
              time.hours.map((hour) => wallClock(hour, 0)),
              locale,
            ),
          })
        : t('automations.cron.everyHourAt', { minutes });
    }
  }
}

function cronDayText(day: CronDayWords, locale: string, t: TFunction): string {
  const weekday = (index: number) => weekdayName(index, locale, 'long');
  switch (day.kind) {
    case 'everyDay':
      return t('automations.cron.everyDay');
    case 'weekDays':
      return daysText(day.days, locale, t);
    case 'monthDays':
      return t('automations.cron.monthDays', { days: listText(day.days.map(String), locale) });
    case 'lastDay':
      return t('automations.cron.lastDay');
    case 'lastWeekday':
      return t('automations.cron.lastWeekday');
    case 'nthWeekday':
      return t('automations.cron.nthWeekday', {
        nth: t(`automations.cron.ordinal.${day.nth as 1 | 2 | 3 | 4 | 5}`),
        day: weekday(day.day),
      });
    case 'lastWeekdayOf':
      return t('automations.cron.lastWeekdayOf', { day: weekday(day.day) });
    case 'both':
      // A list of weekdays is bare ("Mon"); the other shapes say their own "on the …".
      return t(
        day.weekDays.kind === 'weekDays' ? 'automations.cron.bothDays' : 'automations.cron.both',
        {
          monthDays: cronDayText(day.monthDays, locale, t),
          weekDays: cronDayText(day.weekDays, locale, t),
        },
      );
    case 'either':
      return t('automations.cron.either', {
        monthDays: cronDayText(day.monthDays, locale, t),
        weekDays: cronDayText(day.weekDays, locale, t),
      });
  }
}

/**
 * A cron schedule in words, never its fields: "Every 15 minutes from 09:00 to
 * 17:45, Mon–Fri". The zone's short name follows when it is not the reader's.
 */
function cronText(rule: ScheduleWords, locale: string, t: TFunction): string {
  const words = describeCron(rule.expression ?? '');
  if (!words) return t('automations.cron.custom');
  const time = cronTimeText(words.time, locale, t);
  const day = cronDayText(words.day, locale, t);
  const sentence = words.months
    ? t('automations.cron.sentenceMonths', {
        time,
        day,
        months: listText(
          words.months.map((month) =>
            dateFormatter(locale, { month: 'long', timeZone: 'UTC' }).format(
              new Date(Date.UTC(2023, month - 1, 1)),
            ),
          ),
          locale,
        ),
      })
    : t('automations.cron.sentence', { time, day });
  return rule.timezone === viewerTimeZone()
    ? sentence
    : t('automations.cron.zoned', { sentence, zone: timeZoneAbbreviation(rule.timezone) });
}

export function eventLabel(event: GithubEventType, t: TFunction): string {
  return t(`automations.event.${event}.label`, {
    defaultValue: externalEventDefinition('github', event)?.label ?? event,
  });
}

function eventText(event: GithubEventType, t: TFunction): string {
  const label = eventLabel(event, t);
  return t('automations.trigger.event', {
    event: label.charAt(0).toLocaleLowerCase() + label.slice(1),
  });
}

/** A trigger as words: a saved one, an editor card, a bot's routine's. */
export type TriggerWords =
  | ({ source: 'schedule' } & ScheduleWords)
  | { source: 'github'; event: GithubEventType }
  | { source: 'gmail'; query: string | null };

function triggerText(trigger: TriggerWords, locale: string, t: TFunction): string {
  switch (trigger.source) {
    case 'schedule':
      return scheduleText(trigger, locale, t);
    case 'github':
      return eventText(trigger.event, t);
    case 'gmail':
      return trigger.query
        ? t('automations.trigger.mail', { query: trigger.query })
        : t('automations.trigger.anyMail');
  }
}

/**
 * A list of triggers as one line: the first in words, and how many more
 * ("Weekdays at 09:00 +2"), or "Manual only" with none. `label` dresses the
 * first one's words for where they show (a bot's card says "Schedule · …");
 * the table takes them as they are.
 */
export function triggerListText(
  triggers: readonly TriggerWords[],
  locale: string,
  t: TFunction,
  label: (trigger: TriggerWords, words: string) => string = (_trigger, words) => words,
): string {
  const [first, ...rest] = triggers;
  if (!first) return t('automations.trigger.manual');
  const summary = label(first, triggerText(first, locale, t));
  return rest.length ? t('automations.trigger.more', { summary, count: rest.length }) : summary;
}
