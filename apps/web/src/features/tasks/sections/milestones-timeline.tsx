import {
  EmptyState,
  MilestoneTimeline,
  type MilestoneTimelineControls,
} from '@oppenheimer/design-system-web';
import { useSuspensePlan } from '@oppenheimer/frontend-consumer/react';
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
 * opens the board filtered to it. With none, an illustrated empty state says what a
 * milestone is; the header's New milestone makes one. It reads under Suspense, in the screen's `QueryState`; a
 * refetch that fails keeps the timeline and says so above it.
 */
export function MilestonesTimeline({
  controls,
  onEdit,
}: {
  controls: Ref<MilestoneTimelineControls>;
  onEdit: (milestoneId: string) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const today = useToday();
  const navigate = useNavigate();
  const { projectIds } = useScopeProject();
  const { projects, milestones, tasks, error } = useSuspensePlan();
  const alert = <ErrorAlert error={error} fallback={t('tasks.milestones.loadFailed')} />;

  const named = projects.map((row) => ({
    id: row.id,
    name: row.isUnassigned ? t('tasks.filters.noProject') : row.name,
  }));
  const rows = timelineRows(named, milestones, tasks, projectIds);
  if (rows.length === 0) {
    return (
      <>
        {alert}
        <EmptyState className="rounded-xl bg-card py-14">
          <EmptyState.Header>
            <EmptyState.Art name="milestones" />
            <EmptyState.Title>{t('tasks.milestones.emptyTitle')}</EmptyState.Title>
            <EmptyState.Description>{t('tasks.milestones.empty')}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      </>
    );
  }
  const slugOf = new Map(
    projects.map((row) => [row.id, row.isUnassigned ? UNASSIGNED_SLUG : row.slug]),
  );

  return (
    // Edge to edge, as the frame draws it: the pane cancels its gutter for
    // `data-bleed`. Keyed by the projects so a new filter opens on today again.
    <>
      {alert}
      <MilestoneTimeline
        key={projectIds?.join(',') ?? 'all'}
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
    </>
  );
}
