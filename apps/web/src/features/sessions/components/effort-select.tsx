import { EffortPicker } from '@oppenheimer/design-system-web';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import { toEffortStops } from '../lib/session-options';

/**
 * How hard the agent may think: the five-stop slider, in a popover.
 *
 * A slider rather than a list because the stops are ordered and somebody
 * setting one is comparing rather than picking a name
 * (`product/versions/mvp/05-screens.md`). The stops are the product's five;
 * what each means to a given CLI is catalog data, and an agent whose
 * vocabulary is coarser says so there rather than here.
 *
 * The section above renders this only for an agent that has a notion of effort
 * at all, so there is no disabled state to explain.
 */
export function EffortSelect({
  value,
  onValueChange,
  disabled,
}: {
  value: SessionEffort;
  onValueChange: (value: SessionEffort) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <EffortPicker
      value={value}
      onValueChange={(next) => onValueChange(next as SessionEffort)}
      disabled={disabled}
      label={t('sessions.new.effort.label')}
      stops={toEffortStops({
        minimal: t('sessions.new.effort.minimal'),
        low: t('sessions.new.effort.low'),
        medium: t('sessions.new.effort.medium'),
        high: t('sessions.new.effort.high'),
        max: t('sessions.new.effort.max'),
      })}
    />
  );
}
