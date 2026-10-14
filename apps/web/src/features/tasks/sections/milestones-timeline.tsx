import {
  MilestoneTimeline,
  type MilestoneTimelineControls,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useMilestones, useProjects, useTasks } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useLocale } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { useToday } from '../hooks/use-today';
import { UNASSIGNED_SLUG } from '../lib/plan-scope';
import { timelineRows } from '../lib/timeline';

/**
 * Milestones on time (the 2026-10-13 `Tasks` frame): a track per project with
 * its share of tasks done and a diamond per milestone, today a line through
 * every row, edge to edge. A milestone opens its edit dialog; a project's name
 * opens the board filtered to it. With none, the frame's empty card opens New
 * milestone.
 */
export function MilestonesTimeline({
  controls,
  onEdit,
  onNew,
}: {
  controls: Ref<MilestoneTimelineControls>;
  onEdit: (milestoneId: string) => void;
  onNew: () => void;
}) {
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
    return <Skeleton className="h-60 w-full" />;
  }

  const named = projects.data.map((row) => ({
    id: row.id,
    name: row.isUnassigned ? t('tasks.filters.noProject') : row.name,
  }));
  const rows = timelineRows(named, milestones.data, tasks.data, projectId);
  if (rows.length === 0) {
    return (
      <button
        type="button"
        onClick={onNew}
        className="flex max-w-105 flex-col items-start gap-1 rounded-lg border border-border border-dashed px-4.5 py-4 text-left text-sm text-fg-muted hover:text-fg"
      >
        <span className="font-medium text-fg">{t('tasks.milestones.emptyTitle')}</span>
        {t('tasks.milestones.empty')}
      </button>
    );
  }
  const slugOf = new Map(
    projects.data.map((row) => [row.id, row.isUnassigned ? UNASSIGNED_SLUG : row.slug]),
  );

  return (
    // Edge to edge, as the frame draws it: the pane cancels its gutter for
    // `data-bleed`. Keyed by the project so a new filter opens on today again.
    <MilestoneTimeline
      key={projectId ?? 'all'}
      data-bleed
      controls={controls}
      rows={rows}
      today={today}
      locale={locale}
      labels={{
        tasks: (total) => t('tasks.milestones.ofTasks', { count: total }),
        edit: t('tasks.milestones.clickToEdit'),
      }}
      onOpenRow={(id) => navigate({ to: '/plan', search: { project: slugOf.get(id) } })}
      onOpenMilestone={onEdit}
    />
  );
}
