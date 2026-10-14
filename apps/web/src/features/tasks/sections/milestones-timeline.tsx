import {
  MilestoneEmpty,
  MilestoneTimeline,
  type MilestoneTimelineControls,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { useMilestones, useProjects, useTasks } from '@oppenheimer/frontend-consumer/react';
import { combineQueries, QueryState, useLocale } from '@oppenheimer/frontend-web';
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

  const plan = combineQueries(
    combineQueries(projects, milestones, (projectRows, milestoneRows) => ({
      projectRows,
      milestoneRows,
    })),
    tasks,
    ({ projectRows, milestoneRows }, taskRows) => {
      const named = projectRows.map((row) => ({
        id: row.id,
        name: row.isUnassigned ? t('tasks.filters.noProject') : row.name,
      }));
      const slugOf = new Map(
        projectRows.map((row) => [row.id, row.isUnassigned ? UNASSIGNED_SLUG : row.slug]),
      );
      return { rows: timelineRows(named, milestoneRows, taskRows, projectId), slugOf };
    },
  );

  return (
    <QueryState query={plan} isEmpty={({ rows }) => rows.length === 0}>
      <QueryState.Pending>
        <Skeleton className="h-60 w-full" />
      </QueryState.Pending>
      <QueryState.Error fallback={t('tasks.milestones.loadFailed')} />
      <QueryState.Empty>
        <MilestoneEmpty
          title={t('tasks.milestones.emptyTitle')}
          onClick={onNew}
          className="max-w-105"
        >
          {t('tasks.milestones.empty')}
        </MilestoneEmpty>
      </QueryState.Empty>
      <QueryState.Data of={plan}>
        {({ rows, slugOf }) => (
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
        )}
      </QueryState.Data>
    </QueryState>
  );
}
