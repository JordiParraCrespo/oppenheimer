import {
  DragProvider,
  EmptyState,
  SortableGroup,
  sortableProjectId,
} from '@oppenheimer/design-system-web';
import { type SessionEntity, sessionAgentLabel } from '@oppenheimer/frontend-consumer';
import { useSuspenseSessionsSidebar } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useDragLabels } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { SessionsSidebarHead } from '../components/sessions-sidebar-head';
import { SidebarDragCopy } from '../components/sidebar-drag-copy';
import { useFoldedGroups } from '../hooks/use-folded-groups';
import { useFoldedSessions } from '../hooks/use-folded-sessions';
import { useHiddenProjects } from '../hooks/use-hidden-projects';
import { usePinnedOnly } from '../hooks/use-pinned-only';
import { SessionPinsContext, useSessionPins } from '../hooks/use-session-pins';
import {
  SessionSelectionContext,
  useSelecting,
  useSessionSelectionStore,
} from '../hooks/use-session-selection';
import { useShowHidden } from '../hooks/use-show-hidden';
import { PROJECTS_GROUP, useSidebarOrder } from '../hooks/use-sidebar-order';
import { listedProjects } from '../lib/hidden-projects';
import { listedSessions } from '../lib/hidden-sessions';
import {
  activeFilters,
  agentOptions,
  applyFilters,
  DEFAULT_FILTERS,
  hostOptions,
  isFiltered,
  projectOptions,
  repositoryOptions,
  type SessionFilters,
  withoutChip,
} from '../lib/session-filters';
import { matchesQuery, sidebarList } from '../lib/session-groups';
import { splitPinned } from '../lib/session-pins';
import { PinnedGroup } from './pinned-group';
import { ProjectGroup } from './project-group';
import { SessionsSelectionBar } from './sessions-selection-bar';

/**
 * The dialog loads when first opened: the sidebar is on every authenticated
 * route, so what it imports is the console's first load.
 */
const DeleteSessionDialog = lazy(() =>
  import('../dialogs/delete-session').then((module) => ({ default: module.DeleteSessionDialog })),
);
const DeleteSessionsDialog = lazy(() =>
  import('../dialogs/delete-sessions').then((module) => ({ default: module.DeleteSessionsDialog })),
);

/**
 * The console's sidebar below New session, in `SessionsSidebar`'s
 * `QueryState.Data`: the sessions grouped by project
 * (`product/versions/mvp/05-screens.md`). It reads the sessions, the projects
 * in API order and the hosts a facet names under Suspense, side by side, and
 * holds only the state siblings share: the filters and settled search, the
 * folded groups, the row whose delete is up (its dialog outlives the row) and
 * the last failed write (a menu closes on its pick, so it shows above the
 * list). A refetch that fails keeps the groups and says so above them.
 *
 * Filters and search are state, not URL: the console's URL is the open
 * session, and a filter must not change which one that is.
 *
 * The projects and their sessions drag into the reader's own order
 * (`useSidebarOrder`), on the sidebar's own `DragProvider`. The sessions the
 * reader pinned (`useSessionPins`), from a row's menu or by dropping it on
 * Pinned, are drawn above the projects instead of in them, still filtered
 * and searched like the rest; a project left with no session to draw is not
 * drawn at all. The groups the reader folded stay
 * folded on the next visit (`useFoldedGroups`), and so do the projects the
 * reader hid from the filter menu (`useHiddenProjects`): a
 * hidden project's group and sessions are not drawn, unless the project
 * filter picks it, and its pinned sessions stay pinned. Pinned only
 * (`usePinnedOnly`), kept on this device too, draws Pinned and no project.
 * A session hidden through the API (a bot's, a script's, or one the reader
 * hid from its menu) is not drawn anywhere, pinned or not, until Show hidden
 * sessions (`useShowHidden`, kept on this device) draws it, marked Hidden.
 *
 * Rows can be picked to act on together (`useSessionSelectionStore`): the
 * store is the sidebar's, each row subscribes to its own pick, and the sidebar
 * reads only whether anything is picked, which swaps the Sessions line for
 * the selection bar. A Shift-click spans the rows as drawn here.
 *
 * The Sessions heading folds the whole list away (`useFoldedSessions`), like
 * a section's Bots heading; the folds of the groups inside it are kept.
 */
export function SessionsSidebarBody() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessions: all, projects, hosts: everyHost, error } = useSuspenseSessionsSidebar();
  const hosts = everyHost.map((host) => ({ id: host.id, name: host.name }));
  const [filters, setFilters] = useState<SessionFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState('');
  const { folded: closed, setOpen } = useFoldedGroups();
  const list = useFoldedSessions();
  const { hidden, setShown, showAll } = useHiddenProjects();
  const { pinnedOnly, setPinnedOnly } = usePinnedOnly();
  const { showHidden, setShowHidden } = useShowHidden();
  const [deleting, setDeleting] = useState<SessionEntity | null>(null);
  const [deletingMany, setDeletingMany] = useState<SessionEntity[] | null>(null);
  // A later write that lands clears it, and so does Dismiss.
  const [failure, setFailure] = useState<Error | null>(null);
  const dialogs = useConsoleDialog();
  const dragLabels = useDragLabels();

  const options = {
    project: projectOptions(
      projects.map((project) => ({
        id: project.id,
        name: project.isUnassigned ? t('projects.unassigned') : project.name,
      })),
      t('sessions.filters.allProjects'),
    ),
    repository: repositoryOptions(all, t('sessions.filters.allRepositories')),
    // An agent's name is the vendor's product name, the catalog's own.
    agent: agentOptions(all, t('sessions.filters.allAgents'), sessionAgentLabel),
    host: hostOptions(all, hosts, t('sessions.filters.allHosts')),
  };
  const hiddenSessions = listedSessions(all, showHidden);
  const visible = applyFilters(hiddenSessions.sessions, filters).filter((session) =>
    matchesQuery(session, query),
  );
  const dirty = isFiltered(filters);
  const narrowed = dirty || query.trim().length > 0;
  const pins = useSessionPins();
  const { pinned, rest } = splitPinned(visible, pins.pins);
  const picked = filters.project[0] ?? null;
  const listing = listedProjects(projects, rest, hidden, picked);
  const {
    groups,
    pinned: pinnedRows,
    carrying,
    handlers,
  } = useSidebarOrder({
    projects,
    listed: listing.listed,
    sessions: listing.sessions,
    pinned,
    pins,
    custom: filters.sort === 'custom',
    onReorder: () => setFilters((current) => ({ ...current, sort: 'custom' })),
    onWrite: setFailure,
  });
  const occupied = new Set(listing.sessions.map((session) => session.projectId));
  const { shown, count, empty } = sidebarList(t, {
    pinnedOnly,
    groups,
    occupied,
    picked,
    pinned,
    hiddenCount: listing.hiddenCount,
    narrowed,
    query,
  });
  // A folded group's rows are not drawn, so a Shift-click does not reach them;
  // nor are any while the whole list is folded.
  const drawn = !list.open
    ? []
    : [
        ...pinned,
        ...shown.flatMap(({ project, sessions: members }) =>
          closed.includes(project?.id ?? 'unfiled') ? [] : members,
        ),
      ];
  const selection = useSessionSelectionStore(drawn.map((session) => session.id));
  const selecting = useSelecting(selection);

  return (
    <SessionSelectionContext value={selection}>
      {/* The pins reach the head too: the selection bar pins what is picked. */}
      <SessionPinsContext value={pins}>
        <SessionsSidebarHead
          sessionCount={count}
          filters={filters}
          options={options}
          dirty={dirty}
          visibility={{
            hidden,
            hiddenCount: listing.hiddenCount,
            onShownChange: setShown,
            onShowAll: showAll,
            pinnedOnly,
            onPinnedOnlyChange: setPinnedOnly,
            showHidden,
            onShowHiddenChange: setShowHidden,
            hiddenSessionCount: hiddenSessions.hiddenCount,
          }}
          chips={activeFilters(filters, options)}
          onFiltersChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
          onFiltersClear={() =>
            setFilters((current) => ({ ...DEFAULT_FILTERS, sort: current.sort }))
          }
          onFacetClear={(chip) => setFilters((current) => withoutChip(current, chip))}
          onNewProject={() => dialogs.open({ kind: 'project' })}
          query={query}
          onQueryChange={setQuery}
          open={list.open}
          onOpenChange={list.setOpen}
          selectionBar={
            selecting ? (
              <SessionsSelectionBar
                sessions={visible}
                projects={projects}
                onDelete={setDeletingMany}
                onWrite={setFailure}
              />
            ) : undefined
          }
        />

        <ErrorAlert
          error={error}
          fallback={t('sessions.sidebar.loadFailed')}
          className="mx-3 mb-2"
        />

        <ErrorAlert
          error={failure}
          fallback={t('sessions.sidebar.writeFailed')}
          onDismiss={() => setFailure(null)}
          className="mx-3 mb-2"
        />

        {list.open ? (
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-5">
            {/* No project at all: the way to one is Plan's Projects view and the
            chip on New session, and the row says so rather than arguing with
            the pane. */}
            {empty !== null ? (
              <div className="px-3 pt-2">
                <EmptyState compact>
                  <EmptyState.Header>
                    <EmptyState.Description>{empty}</EmptyState.Description>
                  </EmptyState.Header>
                </EmptyState>
              </div>
            ) : (
              <DragProvider
                {...handlers}
                labels={dragLabels}
                overlay={(active) => <SidebarDragCopy item={active} />}
              >
                {pinnedRows.length > 0 || carrying ? (
                  <PinnedGroup
                    sessions={pinnedRows}
                    narrowed={narrowed}
                    onShare={(target) =>
                      dialogs.open({ kind: 'share-session', sessionId: target.id })
                    }
                    onDelete={setDeleting}
                    onWrite={setFailure}
                  />
                ) : null}
                <SortableGroup
                  id={PROJECTS_GROUP}
                  items={shown.flatMap(({ project }) =>
                    project ? [sortableProjectId(project.id)] : [],
                  )}
                  accepts={['project']}
                >
                  {shown.map(({ project, sessions: members }) => {
                    const key = project?.id ?? 'unfiled';
                    return (
                      <ProjectGroup
                        key={key}
                        project={project}
                        sessions={members}
                        open={!closed.includes(key)}
                        onOpenChange={(next) => setOpen(key, next)}
                        narrowed={narrowed}
                        query={query}
                        onNewSessionHere={(target) =>
                          navigate({ to: '/sessions/new', search: { project: target.id } })
                        }
                        onShare={(target) =>
                          dialogs.open({ kind: 'share-session', sessionId: target.id })
                        }
                        onDelete={setDeleting}
                        onWrite={setFailure}
                      />
                    );
                  })}
                </SortableGroup>
              </DragProvider>
            )}
          </div>
        ) : null}

        <Suspense fallback={null}>
          {deleting ? (
            <DeleteSessionDialog session={deleting} onClose={() => setDeleting(null)} />
          ) : null}
          {deletingMany ? (
            <DeleteSessionsDialog sessions={deletingMany} onClose={() => setDeletingMany(null)} />
          ) : null}
        </Suspense>
      </SessionPinsContext>
    </SessionSelectionContext>
  );
}
