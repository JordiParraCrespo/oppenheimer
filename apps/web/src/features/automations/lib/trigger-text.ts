import type { AutomationEntity, AutomationTrigger } from '@oppenheimer/frontend-consumer';
import { dateFormatter } from '@oppenheimer/frontend-web';
import {
  externalEventDefinition,
  type GithubEventType,
  type ScheduleFrequency,
  timeZoneAbbreviation,
} from '@oppenheimer/shared/automations';
import type { TFunction } from 'i18next';
import { pad2, viewerTimeZone, wallClock, weekdayDate } from './time';

/**
 * A trigger in words, the way the frames say it: "Weekdays at 08:30",
 * "Every Mon, Wed at 09:00", "On pull request opened". The words are the
 * locale's; the structure is here once, for the table, the page header, the
 * runs facet and the editor's trigger cards alike.
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
      return t('automations.trigger.hourly', { minute: pad2(rule.minute) });
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

function triggerText(trigger: AutomationTrigger, locale: string, t: TFunction): string {
  return trigger.source === 'schedule'
    ? scheduleText(trigger, locale, t)
    : eventText(trigger.event, t);
}

/** The table's trigger column: the first trigger, and how many more there are. */
export function automationTriggerText(
  automation: AutomationEntity,
  locale: string,
  t: TFunction,
): string {
  const [first, ...rest] = automation.triggers;
  if (!first) return t('automations.trigger.manual');
  const summary = triggerText(first, locale, t);
  return rest.length ? t('automations.trigger.more', { summary, count: rest.length }) : summary;
}
