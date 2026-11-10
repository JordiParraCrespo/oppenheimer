import { ProjectOverviewSkeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus, QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ProjectStatsSkeleton } from '../components/project-stats-skeleton';
import type { ProjectView } from '../hooks/use-project-view';
import { ProjectOverviewSection } from './project-overview';
import { ProjectStatsSection } from './project-stats';

/**
 * The view a project's page shows under its switch, in one Suspense
 * boundary keyed by the view, so switching starts the other view's read
 * rather than showing this one's failure. Each view brings its placeholder,
 * its failure line and its section.
 */
export function ProjectViewBody({ projectId, view }: { projectId: string; view: ProjectView }) {
  const { t } = useTranslation();
  const stats = view === 'stats';

  return (
    <QueryState key={view}>
      <QueryState.Pending>
        {stats ? (
          <ProjectStatsSkeleton />
        ) : (
          <section aria-busy>
            <LoadingStatus />
            <ProjectOverviewSkeleton
              labels={[t('projects.detail.milestones'), t('projects.detail.needsInput')]}
            />
          </section>
        )}
      </QueryState.Pending>
      <QueryState.Error
        fallback={t(stats ? 'projects.stats.loadFailed' : 'projects.detail.loadFailed')}
      />
      <QueryState.Data>
        {stats ? (
          <ProjectStatsSection projectId={projectId} />
        ) : (
          <ProjectOverviewSection projectId={projectId} />
        )}
      </QueryState.Data>
    </QueryState>
  );
}
