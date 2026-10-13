import { FactGrid, FactTile, Panel, Skeleton, StatCard } from '@oppenheimer/design-system-web';
import { useMilestones, useTasks } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatCalendarDay, useLocale } from '@oppenheimer/frontend-web';
import { summarizePlan } from '@oppenheimer/shared/plan';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { useToday } from '../hooks/use-today';

/**
 * Where one project stands (`23-plan-milestones-stats-accounts.md` §3): done of
 * all, in progress, what needs a person (blocked or overdue), the next
 * milestone, and the lists behind those numbers. The figures come from
 * `summarizePlan`, the one function the agents answer from too.
 */
export function ProjectOverview() {
  const { t } = useTranslation();
  const locale = useLocale();
  const today = useToday();
  const { projectId } = useScopeProject();
  const tasks = useTasks();
  const milestones = useMilestones();
  if (!projectId) return null;
  const failed = tasks.error ?? milestones.error;
  if (failed) return <ErrorAlert error={failed} fallback={t('tasks.overview.loadFailed')} />;
  if (!tasks.data || !milestones.data) return <Skeleton className="h-40 w-full" />;

  const [summary] = summarizePlan(
    tasks.data.filter((task) => task.projectId === projectId),
    milestones.data.filter((milestone) => milestone.projectId === projectId),
    today,
  );
  if (!summary) return null;
  const day = (iso: string) => formatCalendarDay(iso, locale, 'short');
  const percent = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        <StatCard
          label={t('tasks.overview.done')}
          value={summary.done}
          unit={`/ ${summary.total}`}
          detail={t('tasks.overview.percent', { percent })}
        />
        <StatCard label={t('tasks.overview.doing')} value={summary.doing.length} />
        <StatCard
          label={t('tasks.overview.needsInput')}
          value={summary.needsInput.length}
          detail={t('tasks.overview.needsInputDetail')}
        />
        <StatCard
          label={t('tasks.overview.nextMilestone')}
          value={summary.nextMilestone?.targetDate ? day(summary.nextMilestone.targetDate) : '—'}
          detail={summary.nextMilestone?.name ?? t('tasks.overview.noMilestone')}
        />
      </div>
      {summary.needsInput.length > 0 ? (
        <Panel title={t('tasks.overview.needsInput')}>
          <FactGrid>
            {summary.needsInput.map((item) => (
              <FactTile
                key={item.taskId}
                dot={item.reason === 'blocked' ? 'warning' : 'danger'}
                label={
                  item.reason === 'blocked'
                    ? t('tasks.overview.blocked', { reason: item.detail })
                    : t('tasks.overview.overdue', { day: day(item.detail) })
                }
              >
                <Link to="/plan" search={{ task: item.taskId }} className="text-fg hover:underline">
                  {item.title}
                </Link>
              </FactTile>
            ))}
          </FactGrid>
        </Panel>
      ) : null}
      {summary.doing.length > 0 ? (
        <Panel title={t('tasks.overview.doing')}>
          <FactGrid>
            {summary.doing.map((item) => (
              <FactTile
                key={item.taskId}
                dot="chart-1"
                label={
                  item.dueDate
                    ? t('tasks.overview.due', { day: day(item.dueDate) })
                    : t('tasks.overview.noDue')
                }
              >
                <Link to="/plan" search={{ task: item.taskId }} className="text-fg hover:underline">
                  {item.title}
                </Link>
              </FactTile>
            ))}
          </FactGrid>
        </Panel>
      ) : null}
    </div>
  );
}
