import { MilestoneTimeline, Skeleton } from '@oppenheimer/design-system-web';
import { useMilestones, useProjects, useTasks } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useLocale } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { useToday } from '../hooks/use-today';
import { timelineRows } from '../lib/timeline';

/**
 * Milestones on time: a track per project with its share done and a diamond
 * per dated milestone, today a line through every row. A milestone opens the
 * board filtered to it; a project's name opens its board.
 */
export function MilestonesTimeline() {
  const { t } = useTranslation();
  const locale = useLocale();
  const today = useToday();
  const navigate = useNavigate();
  const { projectId } = useScopeProject();
  const projects = useProjects();
  const milestones = useMilestones();
  const tasks = useTasks();

  const failed = projects.error ?? milestones.error ?? tasks.error;
  if (failed) return <ErrorAlert error={failed} fallback={t('tasks.milestones.loadFailed')} />;
  if (!projects.data || !milestones.data || !tasks.data) {
    return <Skeleton className="h-40 w-full" />;
  }

  const named = projects.data.map((row) => ({
    id: row.id,
    name: row.isUnassigned ? t('tasks.sidebar.unassigned') : row.name,
  }));
  const rows = timelineRows(named, milestones.data, tasks.data, projectId);
  if (rows.length === 0) return null;
  const slugOf = new Map(
    projects.data.map((row) => [row.id, row.isUnassigned ? 'unassigned' : row.slug]),
  );

  return (
    <MilestoneTimeline
      rows={rows}
      today={today}
      locale={locale}
      labels={{ tasks: (total) => t('tasks.milestones.ofTasks', { count: total }) }}
      onOpenRow={(id) => navigate({ to: '/plan', search: { project: slugOf.get(id) } })}
      onOpenMilestone={(id) => navigate({ to: '/plan', search: { milestone: id } })}
    />
  );
}
