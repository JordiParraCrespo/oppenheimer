import { ProjectOverview } from '../sections/project-overview';
import { StatsCards } from '../sections/stats-cards';
import { StatsCharts } from '../sections/stats-charts';
import { StatsHeader } from '../sections/stats-header';
import { StatsProjects } from '../sections/stats-projects';

/**
 * Plan's Stats (`23-plan-milestones-stats-accounts.md` §4): the period, its
 * figures against the period before, the weekly charts, and then either the
 * projects ranked or, narrowed to one, that project's overview. Each section
 * reads the one Stats request the address names.
 */
export function StatsScreen() {
  return (
    <div className="flex flex-col gap-7">
      <StatsHeader />
      <ProjectOverview />
      <StatsCards />
      <StatsCharts />
      <StatsProjects />
    </div>
  );
}
