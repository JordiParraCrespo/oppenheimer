import {
  externalEventDefinition,
  type GithubEventType,
  type ScheduleFrequency,
  timeZoneAbbreviation,
} from '@oppenheimer/shared/automations';
import type { TFunction } from 'i18next';
import { dateFormatter, viewerTimeZone, wallClock, weekdayDate } from './format-date';

/**
 * A trigger in words, the way the frames say it: "Weekdays at 08:30",
 * "Every Mon, Wed at 09:00", "On pull request opened". The words are the
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
  timezone: string;
};

/** Monday first, the way a week is read. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** "Mon", "Tue"… in the viewer's language, for a 0 = Sunday index. */
export function weekdayName(day: number, locale: string, width: 'short' | 'narrow' = 'short') {
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
  }
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
  | { source: 'github'; event: GithubEventType };

function triggerText(trigger: TriggerWords, locale: string, t: TFunction): string {
  return trigger.source === 'schedule'
    ? scheduleText(trigger, locale, t)
    : eventText(trigger.event, t);
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
