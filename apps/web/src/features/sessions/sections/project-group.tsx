import {
  IconButton,
  SessionList,
  SidebarEmptyRow,
  SidebarProjectGroup,
  SidebarProjectHeader,
} from '@oppenheimer/design-system-web';
import { Plus, Settings2 } from '@oppenheimer/design-system-web/icons';
import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';
import { useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SessionRow, type SessionRowActions } from './session-row';

/**
 * One project's group in the sidebar: the folding header with its count and
 * hover actions, then its rows or the empty row. `project` is null for the
 * sessions whose project the list does not hold, which get a header with no
 * actions.
 *
 * The sidebar owns the open set, the menu and rename state and every
 * mutation; this draws one group and reports what was clicked. It is a
 * section rather than a component for one reason: the header's "one of mine
 * is open" mark is a subscription to the route, a boolean per group, so a
 * navigation re-renders the groups whose mark moved and not the list above
 * them.
 */
export function ProjectGroup({
  project,
  sessions,
  open,
  onOpenChange,
  narrowed,
  query,
  now,
  onNewSessionHere,
  onSettings,
  rows,
}: {
  project: ProjectEntity | null;
  sessions: SessionEntity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether a filter or the search is narrowing the list, which changes what an empty group says. */
  narrowed: boolean;
  query: string;
  /** The sidebar's minute clock, which every row's age is read against. */
  now: number;
  onNewSessionHere: (project: ProjectEntity) => void;
  onSettings: (project: ProjectEntity) => void;
  rows: SessionRowActions;
}) {
  const { t } = useTranslation();
  // Unassigned under its translated name; the API's spelling is English.
  const label = project
    ? project.isUnassigned
      ? t('projects.unassigned')
      : project.name
    : t('sessions.sidebar.unfiled');
  const current = useRouterState({
    select: (state) =>
      sessions.some((session) => state.location.pathname === `/sessions/${session.id}`),
  });

  return (
    <SidebarProjectGroup>
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
          {narrowed
            ? t('sessions.sidebar.noMatches', { query })
            : t('sessions.sidebar.emptyProject')}{' '}
          {project && !narrowed ? (
            <button type="button" onClick={() => onNewSessionHere(project)}>
              {t('sessions.sidebar.startOne')}
            </button>
          ) : null}
        </SidebarEmptyRow>
      ) : (
        <SessionList>
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} now={now} rows={rows} />
          ))}
        </SessionList>
      )}
    </SidebarProjectGroup>
  );
}
