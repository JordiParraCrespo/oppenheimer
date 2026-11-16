import { Button, PageHeader, PageHeaderRow } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { QueryState } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { ProjectSearchField } from '../components/project-search-field';
import { ProjectsListSkeleton } from '../components/projects-list-skeleton';
import { ProjectsList } from '../sections/projects-list';

const projectsRoute = getRouteApi('/_authenticated/plan/projects');

/**
 * Plan's Projects: the workspace's projects as cards, each opening the
 * project's page, where it is edited. The header's New project opens the
 * console's project dialog; its search narrows the cards by name or
 * repository, kept in the address (`?q=`) and written in place, since a
 * search is not a page to go Back to. The cards read under Suspense. The Sessions
 * sidebar only lists sessions by project and starts one in it.
 */
export function ProjectsScreen() {
  const { t } = useTranslation();
  const dialogs = useConsoleDialog();
  const create = () => dialogs.open({ kind: 'project' });
  const query = projectsRoute.useSearch().q ?? '';
  const navigate = projectsRoute.useNavigate();
  const setQuery = (next: string) =>
    navigate({ search: { q: next.trim() ? next : undefined }, replace: true });

  return (
    <div className="flex flex-col gap-7">
      <PageHeader>
        <PageHeaderRow
          size="display"
          title={t('projects.list.title')}
          actions={
            <div className="flex items-center gap-2">
              <ProjectSearchField
                label={t('common.search.projects')}
                value={query}
                onChange={setQuery}
              />
              <Button onClick={create}>
                <Plus />
                {t('projects.list.new')}
              </Button>
            </div>
          }
        />
      </PageHeader>
      <QueryState>
        <QueryState.Pending>
          <ProjectsListSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('projects.list.loadFailed')} />
        <QueryState.Data>
          <ProjectsList query={query} onNew={create} />
        </QueryState.Data>
      </QueryState>
    </div>
  );
}
