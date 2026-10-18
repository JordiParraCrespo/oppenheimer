import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { triggerText } from '@oppenheimer/frontend-web';
import type { TFunction } from 'i18next';

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
