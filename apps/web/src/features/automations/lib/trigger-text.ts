import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { triggerListText } from '@oppenheimer/frontend-web';
import type { TFunction } from 'i18next';

/** The table's trigger column: the first trigger, and how many more there are. */
export function automationTriggerText(
  automation: AutomationEntity,
  locale: string,
  t: TFunction,
): string {
  return triggerListText(automation.triggers, locale, t);
}
