import { DateRangePicker } from '@oppenheimer/design-system-web';
import { useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useStatsRange } from '../hooks/use-stats-range';
import { lastWeeks, STATS_PRESETS } from '../lib/stats-range';

/**
 * The period a project's Stats covers: the named ranges in weeks ending
 * today, or any two days. It writes the URL; the stats under it read the
 * range deferred, so they stay on screen while the next period loads.
 */
export function ProjectStatsRange() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { today, range, setRange } = useStatsRange();
  const presets = STATS_PRESETS.map((preset) => ({
    id: preset.id,
    label: t('projects.stats.range.lastWeeks', { count: preset.weeks }),
    range: lastWeeks(preset.weeks, today),
  }));

  return (
    <DateRangePicker
      value={range}
      onValueChange={setRange}
      presets={presets}
      today={today}
      locale={locale}
      labels={{
        custom: t('projects.stats.range.custom'),
        done: t('projects.stats.range.done'),
        previous: t('projects.stats.range.previousMonth'),
        next: t('projects.stats.range.nextMonth'),
        choose: t('projects.stats.range.choose'),
        days: (count) => t('projects.stats.range.days', { count }),
      }}
    />
  );
}
