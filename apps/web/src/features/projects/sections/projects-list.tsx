import {
  Button,
  EmptyState,
  IconButton,
  SettingsGroup,
  SettingsListRow,
} from '@oppenheimer/design-system-web';
import { Settings2 } from '@oppenheimer/design-system-web/icons';
import { useSuspenseProjects } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { projectListMeta } from '../lib/project-list';

/**
 * The workspace's projects, in API order (newest first): each one's name, its
 * repositories, and its settings, which open the project dialog (where it is
 * also deleted). Unassigned is listed under its translated name. It reads
 * under Suspense, in the screen's `QueryState`; a refetch that fails keeps
 * the list and says so above it.
 */
export function ProjectsList({
  onEdit,
  onNew,
}: {
  onEdit: (projectId: string) => void;
  onNew: () => void;
}) {
  const { t } = useTranslation();
  const { data: projects, error } = useSuspenseProjects();
  const alert = <ErrorAlert error={error} fallback={t('projects.list.loadFailed')} />;

  if (projects.length === 0) {
    return (
      <>
        {alert}
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Description>{t('projects.list.empty')}</EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>
            <Button onClick={onNew}>{t('projects.list.new')}</Button>
          </EmptyState.Content>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      {alert}
      <SettingsGroup>
        {projects.map((project) => {
          const name = project.isUnassigned ? t('projects.unassigned') : project.name;
          return (
            <SettingsListRow
              key={project.id}
              align="center"
              {...projectListMeta(project, t)}
              actions={
                <IconButton
                  size="sm"
                  variant="quiet"
                  aria-label={t('projects.list.edit', { name })}
                  onClick={() => onEdit(project.id)}
                >
                  <Settings2 />
                </IconButton>
              }
            >
              {name}
            </SettingsListRow>
          );
        })}
      </SettingsGroup>
    </>
  );
}
