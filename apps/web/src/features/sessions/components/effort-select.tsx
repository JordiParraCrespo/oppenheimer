import { EffortPicker } from '@oppenheimer/design-system-web';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import { toEffortStops } from '../lib/session-options';

/**
 * How hard the agent may think: a five-stop slider in a popover, because the
 * stops are ordered and the reader compares rather than picks a name
 * (`product/versions/mvp/05-screens.md`). What each stop means to a CLI is
 * catalog data. Only an agent with a notion of effort renders this, so there
 * is no "unsupported" state to explain.
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
      fasterLabel={t('sessions.new.effort.faster')}
      smarterLabel={t('sessions.new.effort.smarter')}
      hint={t('sessions.new.effort.hint')}
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
