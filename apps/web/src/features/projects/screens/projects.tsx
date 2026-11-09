import { Button, PageHeader, PageHeaderRow } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { ProjectsListSkeleton } from '../components/projects-list-skeleton';
import { ProjectsList } from '../sections/projects-list';

/**
 * Plan's Projects: the workspace's projects as cards, each opening the
 * project's page, where it is edited. The header's New project opens the
 * console's project dialog; the cards read under Suspense. The Sessions
 * sidebar only lists sessions by project and starts one in it.
 */
export function ProjectsScreen() {
  const { t } = useTranslation();
  const dialogs = useConsoleDialog();
  const create = () => dialogs.open({ kind: 'project' });

  return (
    <div className="flex flex-col gap-7">
      <PageHeader>
        <PageHeaderRow
          size="display"
          title={t('projects.list.title')}
          actions={
            <Button onClick={create}>
              <Plus />
              {t('projects.list.new')}
            </Button>
          }
        />
      </PageHeader>
      <QueryState>
        <QueryState.Pending>
          <ProjectsListSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('projects.list.loadFailed')} />
        <QueryState.Data>
          <ProjectsList onNew={create} />
        </QueryState.Data>
      </QueryState>
    </div>
  );
}
