import {
  Button,
  EmptyState,
  ProjectCard,
  ProjectCardGrid,
  StatusDot,
} from '@oppenheimer/design-system-web';
import { useSuspenseSessionsSidebar } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { projectRepositoriesLine, projectStatusOf } from '../lib/project-list';

const STATUS_KEY = {
  'needs-input': 'projects.list.status.needsInput',
  running: 'projects.list.status.running',
  idle: 'projects.list.status.idle',
} as const;

/**
 * The workspace's projects as cards, in API order (newest first): each one's
 * name, its repositories, and whether one of its sessions needs you or is at
 * work. A card opens the project's page. Unassigned is listed under its
 * translated name. It reads under Suspense, in the screen's `QueryState`; a
 * refetch that fails keeps the cards and says so above them.
 */
export function ProjectsList({ onNew }: { onNew: () => void }) {
  const { t } = useTranslation();
  const { projects, sessions, error } = useSuspenseSessionsSidebar();
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
      <ProjectCardGrid>
        {projects.map((project) => {
          const status = projectStatusOf(project.id, sessions);
          return (
            <ProjectCard
              key={project.id}
              name={project.isUnassigned ? t('projects.unassigned') : project.name}
              meta={projectRepositoriesLine(project) || t('projects.list.noRepositories')}
              status={
                <StatusDot density="compact" state={status}>
                  {t(STATUS_KEY[status])}
                </StatusDot>
              }
              render={<Link to="/plan/projects/$projectId" params={{ projectId: project.id }} />}
            />
          );
        })}
      </ProjectCardGrid>
    </>
  );
}
