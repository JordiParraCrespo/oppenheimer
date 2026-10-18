import type { BotRoutineEntity } from '@oppenheimer/frontend-consumer';
import { dateFormatter, triggerText } from '@oppenheimer/frontend-web';
import type { TFunction } from 'i18next';

/**
 * A routine's *when*, as its card says it: "Schedule · Weekdays at 09:00",
 * "GitHub · On pull request opened", and how many more triggers it has.
 */
export function routineWhen(routine: BotRoutineEntity, locale: string, t: TFunction): string {
  const [first, ...rest] = routine.triggers;
  if (!first) return '';
  const when = t(
    first.source === 'github' ? 'bots.settings.routines.github' : 'bots.settings.routines.schedule',
    { when: triggerText(first, locale, t) },
  );
  return rest.length ? t('bots.settings.routines.more', { when, count: rest.length }) : when;
}

/** "Mon 28 Sep, 09:00": when it last ran or runs next, in the viewer's zone. */
export function routineMoment(at: Date, locale: string): string {
  return dateFormatter(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
}
