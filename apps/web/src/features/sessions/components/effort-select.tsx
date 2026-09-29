import { EffortPicker } from '@oppenheimer/design-system-web';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import { toEffortStops } from '../lib/session-options';

/**
 * How hard the agent may think: a slider over the model's own levels, in a
 * popover.
 *
 * A slider rather than a list because the levels are ordered and somebody
 * setting one is comparing rather than picking a name
 * (`product/versions/mvp/05-screens.md`). The stops are the levels the model's
 * CLI offers, under that CLI's names — five for Claude Code, six for Sol with
 * `ultra` — so the label on the knob is the level the agent is started at.
 *
 * The section above renders this only for a model that has a notion of effort
 * at all, so there is no disabled state to explain.
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
      onValueChange={(next) => onValueChange(next as SessionEffort)}
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
