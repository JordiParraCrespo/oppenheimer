import { EmptyState, SessionList, Skeleton } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useHosts, useProjects, useSessions } from '@oppenheimer/frontend-consumer/react';
import { combineQueries, ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { CODING_AGENTS } from '@oppenheimer/shared/agents';
import { useNavigate } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { SessionsSidebarHead } from '../components/sessions-sidebar-head';
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
import { groupByProject, matchesQuery } from '../lib/session-groups';
import { NewSessionButton } from './new-session-button';
import { ProjectGroup } from './project-group';

/**
 * The dialog loads when first opened: the sidebar is on every authenticated
 * route, so what it imports is the console's first load.
 */
const DeleteSessionDialog = lazy(() =>
  import('../dialogs/delete-session').then((module) => ({ default: module.DeleteSessionDialog })),
);

/**
 * The console's sidebar body: the sessions grouped by project
 * (`product/versions/mvp/05-screens.md`). It holds the three reads (sessions,
 * projects in API order, hosts for a facet's names) and only the state
 * siblings share: the filters and settled search, the folded groups, the row
 * whose delete is up (its dialog outlives the row) and the last failed write
 * (a menu closes on its pick, so it shows above the list).
 *
 * Filters and search are state, not URL: the console's URL is the open
 * session, and a filter must not change which one that is.
 */
export function SessionsSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: sessions, isPending, error } = useSessions();
  const projects = useProjects();
  // Selected down to plain pairs, which the query keeps by reference across a
  // refetch that changes no name.
  const { data: hosts } = useHosts({
    select: (rows) => rows.map((host) => ({ id: host.id, name: host.name })),
  });
  const [filters, setFilters] = useState<SessionFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<SessionEntity | null>(null);
  // A later write that lands clears it, and so does Dismiss.
  const [failure, setFailure] = useState<Error | null>(null);
  const dialogs = useConsoleDialog();

  const all = sessions ?? [];
  const options = sessions
    ? {
        project: projectOptions(
          projects.data?.map((project) => ({
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
      }
    : undefined;
  const visible = applyFilters(all, filters).filter((session) => matchesQuery(session, query));
  const dirty = isFiltered(filters);
  const narrowed = dirty || query.trim().length > 0;
  const groups = groupByProject(projects.data ?? [], visible);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SessionsSidebarHead
        newSession={<NewSessionButton />}
        projectCount={projects.data?.length}
        filters={filters}
        options={options}
        dirty={dirty}
        chips={options ? activeFilters(filters, options) : []}
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

      <ErrorAlert
        error={failure}
        fallback={t('sessions.sidebar.writeFailed')}
        onDismiss={() => setFailure(null)}
        className="mx-3 mb-2"
      />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-5">
        {/* The rows need both reads: a session's group is its project. A failed
            read is not an empty list and not a list still loading. */}
        <QueryState
          query={combineQueries({ isPending, error, data: sessions }, projects, () => groups)}
          pending={
            <SessionList className="mx-3 mt-2">
              <Skeleton shape="sm" className="h-7.5 w-full" />
              <Skeleton shape="sm" className="h-7.5 w-full" />
              <Skeleton shape="sm" className="h-7.5 w-full" />
            </SessionList>
          }
          errorFallback={t('sessions.sidebar.loadFailed')}
          errorClassName="mx-3 mt-2"
          // No project at all: the way to one is the plus above and the chip
          // on New session, and the row says so rather than arguing with the
          // pane.
          empty={{
            when: (ready) => ready.length === 0,
            show: (
              <div className="px-3 pt-2">
                <EmptyState compact>
                  <EmptyState.Header>
                    <EmptyState.Description>{t('sessions.sidebar.empty')}</EmptyState.Description>
                  </EmptyState.Header>
                </EmptyState>
              </div>
            ),
          }}
        >
          {(ready) =>
            ready.map(({ project, sessions: members }) => {
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
                  onDelete={setDeleting}
                  onWrite={setFailure}
                />
              );
            })
          }
        </QueryState>
      </div>

      <Suspense fallback={null}>
        {deleting ? (
          <DeleteSessionDialog session={deleting} onClose={() => setDeleting(null)} />
        ) : null}
      </Suspense>
    </div>
  );
}
