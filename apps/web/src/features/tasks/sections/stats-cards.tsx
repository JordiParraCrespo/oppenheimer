import { Skeleton, StatCard, StatDelta } from '@oppenheimer/design-system-web';
import { usePlanStats } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useStatsPeriod } from '../hooks/use-stats-period';
import { deltaOf } from '../lib/stats';
import { formatCompact, formatUsd } from '../lib/stats-format';

/**
 * Stats' four figures: tasks completed, tasks created, tokens and agent cost,
 * each against the period before when comparing. A figure no source measures
 * yet says so rather than showing a zero.
 */
export function StatsCards() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { request } = useStatsPeriod();
  const stats = usePlanStats(request);

  if (stats.isPending) return <Skeleton className="h-28 w-full" />;
  if (stats.isError)
    return <ErrorAlert error={stats.error} fallback={t('tasks.stats.loadFailed')} />;

  const { current, previous } = stats.data;
  const delta = (
    value: number | null,
    before: number | null | undefined,
    better: 'up' | 'down' | 'none',
  ) => {
    const change = deltaOf(value, before, better);
    return change ? (
      <StatDelta value={change.value} tone={change.tone}>
        {t('tasks.stats.vsPrevious')}
      </StatDelta>
    ) : undefined;
  };

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
      <StatCard
        label={t('tasks.stats.cards.completed')}
        value={current.tasksCompleted}
        detail={delta(current.tasksCompleted, previous?.tasksCompleted, 'up')}
      />
      <StatCard
        label={t('tasks.stats.cards.created')}
        value={current.tasksCreated}
        detail={delta(current.tasksCreated, previous?.tasksCreated, 'none')}
      />
      <StatCard
        label={t('tasks.stats.cards.tokens')}
        value={current.tokens === null ? '—' : formatCompact(current.tokens, locale)}
        detail={
          current.tokens === null
            ? t('tasks.stats.notMeasured')
            : delta(current.tokens, previous?.tokens, 'none')
        }
      />
      <StatCard
        label={t('tasks.stats.cards.cost')}
        value={current.costUsd === null ? '—' : formatUsd(current.costUsd, locale)}
        detail={
          current.costUsd === null
            ? t('tasks.stats.notMeasured')
            : (delta(current.costUsd, previous?.costUsd, 'down') ??
              (current.tasksCompleted
                ? t('tasks.stats.perTask', {
                    cost: formatUsd(current.costUsd / current.tasksCompleted, locale),
                  })
                : undefined))
        }
      />
    </div>
  );
}
