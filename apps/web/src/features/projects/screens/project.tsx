import {
  Button,
  PageHeader,
  PageHeaderCrumbs,
  PageHeaderHere,
  PageHeaderRow,
  ProjectOverviewSkeleton,
  SegmentedControl,
  SegmentedControlItem,
} from '@oppenheimer/design-system-web';
import { Settings2 } from '@oppenheimer/design-system-web/icons';
import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { LoadingStatus, QueryState } from '@oppenheimer/frontend-web';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { ProjectStatsSkeleton } from '../components/project-stats-skeleton';
import { type ProjectView, useProjectView } from '../hooks/use-project-view';
import { ProjectOverviewSection } from '../sections/project-overview';
import { ProjectStatsSection } from '../sections/project-stats';
import { ProjectStatsRange } from '../sections/project-stats-range';

/**
 * A project's page, opened from its card on Plan's Projects: the way back to
 * the cards, the name, its settings (the console's project dialog), and its
 * Overview or its Stats (`?view=stats`, with the period beside the switch),
 * each under Suspense with a key of its own. The name in the head is a plain
 * read, so it never blinks while a view loads.
 */
export function ProjectScreen({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const dialogs = useConsoleDialog();
  const navigate = useNavigate();
  const { view, setView } = useProjectView();
  const { data: name } = useProjects({
    select: (rows) => {
      const project = rows.find((row) => row.id === projectId);
      if (!project) return undefined;
      return project.isUnassigned ? t('projects.unassigned') : project.name;
    },
  });

  return (
    <div className="flex flex-col gap-7">
      <PageHeader>
        <PageHeaderCrumbs aria-label={t('common.breadcrumb')}>
          <Link to="/plan/projects">{t('projects.detail.back')}</Link>
          <span>/</span>
          <PageHeaderHere>{name}</PageHeaderHere>
        </PageHeaderCrumbs>
        <PageHeaderRow
          size="display"
          title={name ?? ''}
          actions={
            name ? (
              <Button
                variant="secondary"
                onClick={() =>
                  dialogs.open({
                    kind: 'project',
                    projectId,
                    onDeleted: () => navigate({ to: '/plan/projects' }),
                  })
                }
              >
                <Settings2 />
                {t('projects.detail.settings')}
              </Button>
            ) : null
          }
        />
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          value={view}
          onValueChange={(next) => setView(next as ProjectView)}
          aria-label={t('projects.detail.views')}
        >
          <SegmentedControlItem value="overview">
            {t('projects.detail.overview')}
          </SegmentedControlItem>
          <SegmentedControlItem value="stats">{t('projects.detail.stats')}</SegmentedControlItem>
        </SegmentedControl>
        {view === 'stats' ? (
          <span className="ml-auto">
            <ProjectStatsRange />
          </span>
        ) : null}
      </div>
      {view === 'stats' ? (
        <QueryState key="stats">
          <QueryState.Pending>
            <ProjectStatsSkeleton />
          </QueryState.Pending>
          <QueryState.Error fallback={t('projects.stats.loadFailed')} />
          <QueryState.Data>
            <ProjectStatsSection projectId={projectId} />
          </QueryState.Data>
        </QueryState>
      ) : (
        <QueryState key="overview">
          <QueryState.Pending>
            <section aria-busy>
              <LoadingStatus />
              <ProjectOverviewSkeleton
                labels={[t('projects.detail.milestones'), t('projects.detail.needsInput')]}
              />
            </section>
          </QueryState.Pending>
          <QueryState.Error fallback={t('projects.detail.loadFailed')} />
          <QueryState.Data>
            <ProjectOverviewSection projectId={projectId} />
          </QueryState.Data>
        </QueryState>
      )}
    </div>
  );
}
