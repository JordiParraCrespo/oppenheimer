import {
  Button,
  Checkbox,
  EmptyState,
  IconButton,
  ProjectCard,
  ProjectCardGrid,
  StatusDot,
  TaskSelectionBar,
} from '@oppenheimer/design-system-web';
import { Trash2, X } from '@oppenheimer/design-system-web/icons';
import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useSuspenseSessionsSidebar } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useMultiSelection } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteProjectsDialog } from '../dialogs/delete-projects';
import {
  projectRepositoriesLine,
  projectStatusOf,
  projectsWithOpenSessions,
} from '../lib/project-list';

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
 *
 * Each card's checkbox (on hover, or on every card once one is picked) picks
 * it for a bulk delete; while any is picked, a click on a card toggles it
 * rather than opening it, and the selection bar at the foot deletes them all.
 * Unassigned and a project with an open session take no checkbox: the API
 * refuses to delete either, as the project dialog's Delete is off for them.
 */
export function ProjectsList({ onNew }: { onNew: () => void }) {
  const { t } = useTranslation();
  const { projects, sessions, error } = useSuspenseSessionsSidebar();
  const held = projectsWithOpenSessions(sessions);
  const pickable = projects
    .filter((project) => !project.isUnassigned && !held.has(project.id))
    .map((project) => project.id);
  const selection = useMultiSelection(pickable);
  const [deleting, setDeleting] = useState<ProjectEntity[] | null>(null);
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
          const name = project.isUnassigned ? t('projects.unassigned') : project.name;
          const canPick = pickable.includes(project.id);
          const picked = selection.has(project.id);
          return (
            <ProjectCard
              key={project.id}
              name={name}
              meta={projectRepositoriesLine(project) || t('projects.list.noRepositories')}
              status={
                <StatusDot density="compact" state={status}>
                  {t(STATUS_KEY[status])}
                </StatusDot>
              }
              selected={picked}
              selecting={selection.any}
              select={
                canPick ? (
                  <Checkbox
                    checked={picked}
                    onCheckedChange={(on, details) =>
                      selection.toggle(
                        project.id,
                        on,
                        details.event instanceof MouseEvent && details.event.shiftKey,
                      )
                    }
                    aria-label={t('projects.selection.selectOne', { name })}
                  />
                ) : undefined
              }
              onClick={(event) => {
                if (!selection.any) return;
                event.preventDefault();
                if (canPick) selection.toggle(project.id, !picked, event.shiftKey);
              }}
              render={<Link to="/plan/projects/$projectId" params={{ projectId: project.id }} />}
            />
          );
        })}
      </ProjectCardGrid>
      {selection.any ? (
        <TaskSelectionBar
          aria-label={t('projects.selection.label')}
          count={t('projects.selection.count', { count: selection.keys.length })}
        >
          <Button size="sm" variant="ghost" onClick={selection.toggleAll}>
            {selection.all ? t('projects.selection.selectNone') : t('projects.selection.selectAll')}
          </Button>
          <IconButton
            size="sm"
            variant="quiet"
            aria-label={t('projects.selection.delete')}
            title={t('projects.selection.delete')}
            onClick={() => setDeleting(projects.filter((project) => selection.has(project.id)))}
          >
            <Trash2 />
          </IconButton>
          <IconButton
            size="sm"
            variant="quiet"
            aria-label={t('projects.selection.clear')}
            title={t('projects.selection.clear')}
            onClick={selection.clear}
          >
            <X />
          </IconButton>
        </TaskSelectionBar>
      ) : null}
      {deleting ? (
        <DeleteProjectsDialog
          projects={deleting}
          onLeft={selection.keep}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}
