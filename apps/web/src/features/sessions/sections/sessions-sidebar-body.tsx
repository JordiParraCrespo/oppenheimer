import {
  DragProvider,
  EmptyState,
  SortableGroup,
  sortableProjectId,
} from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useSuspenseSessionsSidebar } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, useDragLabels } from '@oppenheimer/frontend-web';
import { CODING_AGENTS } from '@oppenheimer/shared/agents';
import { useNavigate } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { SessionsSidebarHead } from '../components/sessions-sidebar-head';
import { SidebarDragCopy } from '../components/sidebar-drag-copy';
import { useSessionPins } from '../hooks/use-session-pins';
import { PROJECTS_GROUP, useSidebarOrder } from '../hooks/use-sidebar-order';
import {
  ALL,
  activeFilters,
  agentOptions,
  applyFilters,
  DEFAULT_FILTERS,
  hostOptions,
  isFiltered,
  projectOptions,
  repositoryOptions,
  type SessionFilters,
} from '../lib/session-filters';
import { matchesQuery } from '../lib/session-groups';
import { splitPinned } from '../lib/session-pins';
import { PinnedGroup } from './pinned-group';
import { ProjectGroup } from './project-group';

/**
 * The dialog loads when first opened: the sidebar is on every authenticated
 * route, so what it imports is the console's first load.
 */
const DeleteSessionDialog = lazy(() =>
  import('../dialogs/delete-session').then((module) => ({ default: module.DeleteSessionDialog })),
);

/** The pinned group's key among the folded ones, beside the projects' ids. */
const PINNED_KEY = 'pinned';

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
 * reader pinned (`useSessionPins`) are drawn above the projects instead of in
 * them, still filtered and searched like the rest.
 */
export function SessionsSidebarBody() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessions: all, projects, hosts: everyHost, error } = useSuspenseSessionsSidebar();
  const hosts = everyHost.map((host) => ({ id: host.id, name: host.name }));
  const [filters, setFilters] = useState<SessionFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<SessionEntity | null>(null);
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
    agent: agentOptions(
      all,
      t('sessions.filters.allAgents'),
      (agent) => CODING_AGENTS[agent].label,
    ),
    host: hostOptions(all, hosts, t('sessions.filters.allHosts')),
  };
  const visible = applyFilters(all, filters).filter((session) => matchesQuery(session, query));
  const dirty = isFiltered(filters);
  const narrowed = dirty || query.trim().length > 0;
  const { pins, setPinned } = useSessionPins();
  const { pinned, rest } = splitPinned(visible, pins);
  const onPinChange = (session: SessionEntity, next: boolean) => setPinned(session.id, next);
  const { groups, handlers } = useSidebarOrder({
    projects,
    sessions: rest,
    custom: filters.sort === 'custom',
    onReorder: () => setFilters((current) => ({ ...current, sort: 'custom' })),
    onWrite: setFailure,
  });

  return (
    <>
      <SessionsSidebarHead
        projectCount={projects.length}
        filters={filters}
        options={options}
        dirty={dirty}
        chips={activeFilters(filters, options)}
        onFiltersChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
        onFiltersClear={() => setFilters((current) => ({ ...DEFAULT_FILTERS, sort: current.sort }))}
        onFacetClear={(key) => setFilters((current) => ({ ...current, [key]: ALL }))}
        onQueryChange={setQuery}
        onNewProject={() =>
          dialogs.open({
            kind: 'project',
            // A project made from here lands on New session with it picked,
            // which is what a person who just made one wants next.
            onSaved: (project) =>
              navigate({ to: '/sessions/new', search: { project: project.id } }),
          })
        }
      />

      <ErrorAlert error={error} fallback={t('sessions.sidebar.loadFailed')} className="mx-3 mb-2" />

      <ErrorAlert
        error={failure}
        fallback={t('sessions.sidebar.writeFailed')}
        onDismiss={() => setFailure(null)}
        className="mx-3 mb-2"
      />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-5">
        {/* No project at all: the way to one is the plus above and the chip
            on New session, and the row says so rather than arguing with the
            pane. */}
        {groups.length === 0 ? (
          <div className="px-3 pt-2">
            <EmptyState compact>
              <EmptyState.Header>
                <EmptyState.Description>{t('sessions.sidebar.empty')}</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          </div>
        ) : (
          <DragProvider
            {...handlers}
            labels={dragLabels}
            overlay={(active) => <SidebarDragCopy item={active} />}
          >
            {pinned.length > 0 ? (
              <PinnedGroup
                sessions={pinned}
                open={!closed.includes(PINNED_KEY)}
                onOpenChange={(next) =>
                  setClosed((current) =>
                    next ? current.filter((id) => id !== PINNED_KEY) : [...current, PINNED_KEY],
                  )
                }
                onPinChange={onPinChange}
                onShare={(target) => dialogs.open({ kind: 'share-session', sessionId: target.id })}
                onDelete={setDeleting}
                onWrite={setFailure}
              />
            ) : null}
            <SortableGroup
              id={PROJECTS_GROUP}
              items={groups.flatMap(({ project }) =>
                project ? [sortableProjectId(project.id)] : [],
              )}
              accepts={['project']}
            >
              {groups.map(({ project, sessions: members }) => {
                const key = project?.id ?? 'unfiled';
                return (
                  <ProjectGroup
                    key={key}
                    project={project}
                    sessions={members}
                    open={!closed.includes(key)}
                    onOpenChange={(next) =>
                      setClosed((current) =>
                        next ? current.filter((id) => id !== key) : [...current, key],
                      )
                    }
                    narrowed={narrowed}
                    query={query}
                    onNewSessionHere={(target) =>
                      navigate({ to: '/sessions/new', search: { project: target.id } })
                    }
                    onSettings={(target) => dialogs.open({ kind: 'project', projectId: target.id })}
                    onPinChange={onPinChange}
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

      <Suspense fallback={null}>
        {deleting ? (
          <DeleteSessionDialog session={deleting} onClose={() => setDeleting(null)} />
        ) : null}
      </Suspense>
    </>
  );
}
