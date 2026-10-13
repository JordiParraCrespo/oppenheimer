import { BarList, Panel } from '@oppenheimer/design-system-web';
import { usePlanStats, useProjects } from '@oppenheimer/frontend-consumer/react';
import { useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useStatsPeriod } from '../hooks/use-stats-period';
import { formatCompact, formatUsd } from '../lib/stats-format';

/**
 * The workspace's projects ranked by tasks completed in the period, each with
 * its tokens and cost when they are measured. Only over every project: one
 * project's Stats is its overview instead.
 */
export function StatsProjects() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { request } = useStatsPeriod();
  const stats = usePlanStats(request);
  const { data: names } = useProjects({
    select: (rows) =>
      new Map(
        rows.map((row) => [row.id, row.isUnassigned ? t('tasks.sidebar.unassigned') : row.name]),
      ),
  });
  if (request.projectId || !stats.data || stats.data.projects.length === 0) return null;

  const rows = [...stats.data.projects].sort((a, b) => b.tasksCompleted - a.tasksCompleted);
  const top = Math.max(1, ...rows.map((row) => row.tasksCompleted));

  return (
    <Panel title={t('tasks.stats.projects.title')}>
      <BarList
        rows={rows.map((row) => ({
          key: row.projectId,
          label: names?.get(row.projectId) ?? t('tasks.stats.projects.gone'),
          value: t('tasks.stats.projects.done', { count: row.tasksCompleted }),
          share: (row.tasksCompleted / top) * 100,
          detail:
            row.tokens === null || row.costUsd === null
              ? undefined
              : t('tasks.stats.projects.usage', {
                  tokens: formatCompact(row.tokens, locale),
                  cost: formatUsd(row.costUsd, locale),
                }),
        }))}
      />
    </Panel>
  );
}
