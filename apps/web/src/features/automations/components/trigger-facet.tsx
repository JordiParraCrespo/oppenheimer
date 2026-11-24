import { useTranslation } from 'react-i18next';
import type { TriggerSource } from '../lib/list-filters';
import { ChoiceToken } from './choice-token';

const ANY = '__any__';

/**
 * The Trigger facet of the Automations and Bot routines tabs: "Any trigger",
 * then the sources the caller says some row uses, so a pick never lands on
 * nothing. Blue while it narrows.
 */
export function TriggerFacet({
  value,
  sources,
  onValueChange,
}: {
  value: TriggerSource | null;
  sources: readonly TriggerSource[];
  onValueChange: (value: TriggerSource | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <ChoiceToken
      label={t(`automations.filter.trigger.${value ?? 'any'}`)}
      value={value ?? ANY}
      dirty={value !== null}
      options={[
        { value: ANY, label: t('automations.filter.trigger.any') },
        ...sources.map((source) => ({
          value: source,
          label: t(`automations.filter.trigger.${source}`),
        })),
      ]}
      onValueChange={(next) => onValueChange(next === ANY ? null : (next as TriggerSource))}
    />
  );
}
