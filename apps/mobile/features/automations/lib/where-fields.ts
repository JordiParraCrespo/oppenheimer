import { type AutomationEntity, automationAgentText } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';

export interface WhereField {
  label: string;
  value: string;
}

/**
 * The lines of an automation's Where it runs: its repositories when it
 * clones any, its host once the hosts read names it, and always its agent
 * with its model, in that order.
 */
export function whereFields(
  automation: AutomationEntity,
  hostName: string | null,
  t: TFunction,
): WhereField[] {
  const { repositories } = automation.revision;
  const fields: WhereField[] = [];
  if (repositories.length > 0) {
    fields.push({
      label: t('automations.editor.repositories'),
      value: repositories.map((repository) => repository.fullName.split('/').pop()).join(', '),
    });
  }
  if (hostName) fields.push({ label: t('automations.editor.host'), value: hostName });
  fields.push({ label: t('automations.editor.agent'), value: automationAgentText(automation, t) });
  return fields;
}
