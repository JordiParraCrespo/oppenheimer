import { DateRangePicker, PageHeader, PageHeaderRow } from '@oppenheimer/design-system-web';
import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { useLocale } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { useStatsPeriod } from '../hooks/use-stats-period';
import { presetRange, STATS_PRESETS } from '../lib/stats';

const stats = getRouteApi('/_authenticated/plan/stats');

/**
 * Stats' header: the project's name (or Stats), and the period over a
 * `DateRangePicker` with its presets and the compare switch. A preset is a key
 * in the address, a custom range its two days.
 */
export function StatsHeader() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = stats.useNavigate();
  const { request, preset, today } = useStatsPeriod();
  const { projectId } = useScopeProject();
  const { data: projectName } = useProjects({
    select: (rows) => {
      const project = rows.find((row) => row.id === projectId);
      if (!project) return undefined;
      return project.isUnassigned ? t('tasks.sidebar.unassigned') : project.name;
    },
  });
  const presets = STATS_PRESETS.map((id) => ({
    id,
    label: t(`tasks.stats.presets.${id}`),
    range: presetRange(id, today),
  }));

  return (
    <PageHeader>
      <PageHeaderRow
        size="display"
        title={projectName ?? t('tasks.stats.title')}
        actions={
          <DateRangePicker
            value={{ from: request.from, to: request.to }}
            presets={presets}
            today={today}
            locale={locale}
            compare={request.compare}
            onCompareChange={(compare) =>
              navigate({
                search: (previous) => ({ ...previous, compare: compare ? undefined : 'off' }),
                replace: true,
              })
            }
            onValueChange={(range) => {
              const named = presets.find(
                (item) => item.range.from === range.from && item.range.to === range.to,
              );
              navigate({
                search: (previous) => ({
                  ...previous,
                  range: named?.id,
                  from: named ? undefined : range.from,
                  to: named ? undefined : range.to,
                }),
                replace: true,
              });
            }}
            labels={{
              custom: t('tasks.stats.picker.custom'),
              compare: t('tasks.stats.picker.compare'),
              done: t('tasks.stats.picker.done'),
              previous: t('tasks.stats.picker.previous'),
              next: t('tasks.stats.picker.next'),
              choose: t('tasks.stats.picker.choose'),
              days: (count) => t('tasks.stats.picker.days', { count }),
            }}
          />
        }
      />
      {preset === null ? null : (
        <span className="sr-only">{t(`tasks.stats.presets.${preset}`)}</span>
      )}
    </PageHeader>
  );
}
