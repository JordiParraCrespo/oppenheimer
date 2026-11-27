import {
  IconButton,
  SidebarEmptyRow,
  SidebarProjectGroup,
  SidebarProjectHeader,
  SortableGroup,
  SortableSidebarProjectGroup,
} from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';
import { useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useGroupSessionsMenu } from '../hooks/use-group-sessions-menu';
import { emptyMessage } from '../lib/session-groups';
import { SessionRows } from './session-rows';

/**
 * One project's group in the sidebar; `project` is null for sessions whose
 * project the list does not hold, whose header has only the group's menu. A
 * project's header starts a session in it; the project itself is managed
 * from Plan's Projects view. The header's ellipsis, or a right-click on it,
 * hides or deletes every session the group lists (`useGroupSessionsMenu`). Its
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
  onShare,
  onDelete,
  onDeleteAll,
  onWrite,
}: {
  project: ProjectEntity | null;
  sessions: SessionEntity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Whether a filter or the search is narrowing the list, which changes what
   * an empty group says. The rows and the group still drag: a drop keeps the
   * places of the ones it hides (`useSidebarOrder`).
   */
  narrowed: boolean;
  /** The settled search, which an empty group repeats back. */
  query: string;
  onNewSessionHere: (project: ProjectEntity) => void;
  onShare: (session: SessionEntity) => void;
  onDelete: (session: SessionEntity) => void;
  /** Delete every session the group lists, after the sidebar's dialog asks. */
  onDeleteAll: (sessions: SessionEntity[]) => void;
  onWrite: (error: Error | null) => void;
}) {
  const { t } = useTranslation();
  const label = project
    ? project.isUnassigned
      ? t('projects.unassigned')
      : project.name
    : t('sessions.sidebar.unfiled');
  const menu = useGroupSessionsMenu({ label, sessions, onDeleteAll, onWrite });
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
        // A right-click on the header opens the group's menu, not the browser's.
        onContextMenu={menu.onContextMenu}
        menuOpen={menu.menuOpen}
        actions={
          project || menu.action ? (
            <>
              {menu.action}
              {project ? (
                <IconButton
                  size="xs"
                  variant="quiet"
                  aria-label={t('sessions.sidebar.newSessionHere', { name: label })}
                  onClick={() => onNewSessionHere(project)}
                >
                  <Plus />
                </IconButton>
              ) : null}
            </>
          ) : undefined
        }
      />
      {!open ? null : sessions.length === 0 ? (
        <SidebarEmptyRow>
          {emptyMessage(t, narrowed, query)}{' '}
          {project && !narrowed ? (
            <button type="button" onClick={() => onNewSessionHere(project)}>
              {t('sessions.sidebar.startOne')}
            </button>
          ) : null}
        </SidebarEmptyRow>
      ) : (
        <SessionRows
          sessions={sessions}
          dragDisabled={!project}
          onShare={onShare}
          onDelete={onDelete}
          onWrite={onWrite}
        />
      )}
    </SortableGroup>
  );

  return project ? (
    <SortableSidebarProjectGroup id={project.id} label={label}>
      {rows}
    </SortableSidebarProjectGroup>
  ) : (
    <SidebarProjectGroup>{rows}</SidebarProjectGroup>
  );
}
