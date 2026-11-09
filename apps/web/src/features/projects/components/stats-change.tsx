import { StatDelta } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { changeOf } from '../lib/stats-chart';

/**
 * A stat card's line under its figure: the change against the period before,
 * green or red when there is a better way for it to go, or that there is
 * nothing to compare with yet.
 */
export function StatsChange({
  now,
  before,
  higherIsBetter,
}: {
  now: number | null;
  before: number | null | undefined;
  /** `null` when neither way is better (tasks created, tokens). */
  higherIsBetter: boolean | null;
}) {
  const { t } = useTranslation();
  const change = changeOf(now, before, higherIsBetter);
  if (!change) return t('projects.stats.noPrevious');
  return (
    <StatDelta value={change.value} tone={change.tone}>
      {t('projects.stats.vsPrevious')}
    </StatDelta>
  );
}
