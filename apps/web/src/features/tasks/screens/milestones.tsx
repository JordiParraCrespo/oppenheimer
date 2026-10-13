import { PageHeader, PageHeaderRow } from '@oppenheimer/design-system-web';
import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { MilestoneCards } from '../sections/milestone-cards';
import { MilestonesTimeline } from '../sections/milestones-timeline';

/**
 * Plan's Milestones (`23-plan-milestones-stats-accounts.md` §1): the timeline of
 * every project's dated milestones, then a card per milestone. `?project=`
 * narrows both, as it narrows the board.
 */
export function MilestonesScreen() {
  const { t } = useTranslation();
  const { projectId } = useScopeProject();
  const { data: projectName } = useProjects({
    select: (rows) => {
      const project = rows.find((row) => row.id === projectId);
      if (!project) return undefined;
      return project.isUnassigned ? t('tasks.sidebar.unassigned') : project.name;
    },
  });

  return (
    <div className="flex flex-col gap-7">
      <PageHeader>
        <PageHeaderRow size="display" title={projectName ?? t('tasks.milestones.title')} />
      </PageHeader>
      <MilestonesTimeline />
      <MilestoneCards />
    </div>
  );
}
