import type { TimelineRow } from '@oppenheimer/design-system-web';
import type { MilestoneEntity, TaskEntity } from '@oppenheimer/frontend-consumer';

/**
 * The Milestones view's timeline (`23-plan-milestones-stats-accounts.md` §1): a
 * row per project that has a milestone with a target date, its share of tasks
 * done, and those milestones in date order. A milestone with no date has no
 * place on a line of days; the cards under the timeline still show it.
 */
export function timelineRows(
  projects: readonly { id: string; name: string }[],
  milestones: readonly MilestoneEntity[],
  tasks: readonly TaskEntity[],
  projectId?: string,
): TimelineRow[] {
  return projects
    .filter((project) => !projectId || project.id === projectId)
    .map((project) => {
      const own = tasks.filter((task) => task.projectId === project.id);
      const done = own.filter((task) => task.isDone).length;
      return {
        id: project.id,
        name: project.name,
        progress: own.length ? Math.round((done / own.length) * 100) : 0,
        milestones: milestones
          .filter((milestone) => milestone.projectId === project.id && milestone.targetDate)
          .sort((a, b) => ((a.targetDate ?? '') < (b.targetDate ?? '') ? -1 : 1))
          .map((milestone) => ({
            id: milestone.id,
            name: milestone.name,
            due: milestone.targetDate as string,
            done: milestone.doneCount,
            total: milestone.totalCount,
          })),
      };
    })
    .filter((row) => row.milestones.length > 0);
}
