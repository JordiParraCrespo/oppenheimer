import type { BotRoutineEntity } from '@oppenheimer/frontend-consumer';
import { dateFormatter, triggerListText } from '@oppenheimer/frontend-web';
import type { TFunction } from 'i18next';

/** A routine's *when*, as its card says it: "Schedule · Weekdays at 09:00 +1". */
export function routineWhen(routine: BotRoutineEntity, locale: string, t: TFunction): string {
  return triggerListText(routine.triggers, locale, t, (trigger, when) =>
    t(
      trigger.source === 'github'
        ? 'bots.settings.routines.github'
        : 'bots.settings.routines.schedule',
      { when },
    ),
  );
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
