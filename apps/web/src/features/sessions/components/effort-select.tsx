import { EffortPicker } from '@oppenheimer/design-system-web';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import { toEffortStops } from '../lib/session-options';

/**
 * How hard the agent may think: a slider over the model's own levels, in a
 * popover, because the levels are ordered and the reader compares rather
 * than picks a name (`product/versions/mvp/05-screens.md`). The stops are the
 * CLI's levels under its own names. Only a model with a notion of effort
 * renders this, so there is no "unsupported" state to explain.
 */
export function EffortSelect({
  levels,
  value,
  onValueChange,
  disabled,
}: {
  levels: readonly SessionEffort[];
  value: SessionEffort;
  onValueChange: (value: SessionEffort) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <EffortPicker
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      label={t('sessions.new.effort.label')}
      fasterLabel={t('sessions.new.effort.faster')}
      smarterLabel={t('sessions.new.effort.smarter')}
      hint={t('sessions.new.effort.hint')}
      stops={toEffortStops(levels, {
        none: t('sessions.new.effort.none'),
        minimal: t('sessions.new.effort.minimal'),
        low: t('sessions.new.effort.low'),
        medium: t('sessions.new.effort.medium'),
        high: t('sessions.new.effort.high'),
        xhigh: t('sessions.new.effort.xhigh'),
        max: t('sessions.new.effort.max'),
        ultra: t('sessions.new.effort.ultra'),
      })}
    />
  );
}
