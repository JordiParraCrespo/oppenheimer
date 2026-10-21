import {
  IconButton,
  SidebarEmptyRow,
  SidebarProjectGroup,
  SidebarProjectHeader,
  SortableGroup,
  SortableSidebarProjectGroup,
} from '@oppenheimer/design-system-web';
import { Plus, Settings2 } from '@oppenheimer/design-system-web/icons';
import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';
import { useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SessionRows } from './session-rows';

/**
 * One project's group in the sidebar; `project` is null for sessions whose
 * project the list does not hold, which get a header with no actions. Its
 * rows (`SessionRows`) own their ages' clock. It is a section rather than a
 * component because the header's "one of mine is open" mark subscribes to the route, a boolean per
 * group, so a navigation re-renders only the groups whose mark moved.
 *
 * A project's group drags by its header among the others, and its rows are a
 * `SortableGroup` that takes sessions, folded or empty; the group with no
 * project takes none and its rows stay put.
 */
export function ProjectGroup({
  project,
  sessions,
  open,
  onOpenChange,
  narrowed,
  query,
  onNewSessionHere,
  onSettings,
  onShare,
  onDelete,
  onWrite,
}: {
  project: ProjectEntity | null;
  sessions: SessionEntity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Whether a filter or the search is narrowing the list, which changes what
   * an empty group says, and holds the rows and the group still: a drop would
   * lose the places of the ones it hides.
   */
  narrowed: boolean;
  /** The settled search, which an empty group repeats back. */
  query: string;
  onNewSessionHere: (project: ProjectEntity) => void;
  onSettings: (project: ProjectEntity) => void;
  onShare: (session: SessionEntity) => void;
  onDelete: (session: SessionEntity) => void;
  onWrite: (error: Error | null) => void;
}) {
  const { t } = useTranslation();
  const label = project
    ? project.isUnassigned
      ? t('projects.unassigned')
      : project.name
    : t('sessions.sidebar.unfiled');
  const current = useRouterState({
    select: (state) =>
      sessions.some((session) => state.location.pathname === `/sessions/${session.id}`),
  });

  const rows = (
    <SortableGroup
      id={project?.id ?? 'unfiled'}
      // A folded group's rows are not drawn, so it holds none; a drop on it still lands.
      items={open ? sessions.map((session) => session.id) : []}
      accepts={project ? ['session'] : []}
      data={{ label }}
      className="flex flex-col"
    >
      <SidebarProjectHeader
        name={label}
        count={sessions.length}
        open={open}
        onOpenChange={onOpenChange}
        current={current}
        actions={
          project ? (
            <>
              <IconButton
                size="xs"
                variant="quiet"
                aria-label={t('sessions.sidebar.newSessionHere', { name: label })}
                onClick={() => onNewSessionHere(project)}
              >
                <Plus />
              </IconButton>
              <IconButton
                size="xs"
                variant="quiet"
                aria-label={t('sessions.sidebar.projectSettings', { name: label })}
                onClick={() => onSettings(project)}
              >
                <Settings2 />
              </IconButton>
            </>
          ) : undefined
        }
      />
      {!open ? null : sessions.length === 0 ? (
        <SidebarEmptyRow>
          {!narrowed
            ? t('sessions.sidebar.emptyProject')
            : query.trim()
              ? t('sessions.sidebar.noMatches', { query: query.trim() })
              : t('sessions.filters.noMatches')}{' '}
          {project && !narrowed ? (
            <button type="button" onClick={() => onNewSessionHere(project)}>
              {t('sessions.sidebar.startOne')}
            </button>
          ) : null}
        </SidebarEmptyRow>
      ) : (
        <SessionRows
          sessions={sessions}
          dragDisabled={!project || narrowed}
          onShare={onShare}
          onDelete={onDelete}
          onWrite={onWrite}
        />
      )}
    </SortableGroup>
  );

  return project ? (
    <SortableSidebarProjectGroup id={project.id} label={label} disabled={narrowed}>
      {rows}
    </SortableSidebarProjectGroup>
  ) : (
    <SidebarProjectGroup>{rows}</SidebarProjectGroup>
  );
}
