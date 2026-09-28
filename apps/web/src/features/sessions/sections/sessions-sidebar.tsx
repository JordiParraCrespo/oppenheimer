import {
  Alert,
  AlertAction,
  AlertDescription,
  Button,
  EmptyState,
  SessionList,
  Skeleton,
  useNow,
} from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import {
  useHosts,
  useMoveSession,
  useProjects,
  useRenameSession,
  useSessions,
} from '@oppenheimer/frontend-consumer/react';
import { lastFailure, useErrorMessage } from '@oppenheimer/frontend-core/react';
import { notifySuccess, useConsoleDialog } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { groupByProject, matchesQuery, projectsForMove } from '../lib/session-groups';
import { NewSessionButton } from './new-session-button';
import { ProjectGroup } from './project-group';
import type { SessionRowActions } from './session-row';

/**
 * The dialog loads when first opened: the sidebar is on every authenticated
 * route, so what it imports is the console's first load.
 */
const DeleteSessionDialog = lazy(() =>
  import('../dialogs/delete-session').then((module) => ({ default: module.DeleteSessionDialog })),
);

/**
 * The console's sidebar body: the sessions grouped by project
 * (`product/versions/mvp/05-screens.md`).
 *
 * The product is the list, so the list is the navigation. It is a feature
 * rather than kit because it reads product hooks; the brand row above it and
 * the account menu below it are the shell's, and the rail beside it is its
 * sibling section.
 *
 * What lives here is the three reads — the sessions (the rows), the projects
 * (the groups, in the order the API lists them) and the hosts (a facet's
 * names) — the minute clock the ages are read against, the state two siblings
 * share (the filters, the query, the folded groups, which row's menu or rename
 * is open, which row's delete is up) and the two mutations a row cannot own:
 * a rename commits from the inline input, a move from the row menu's pane.
 * The head is a component that draws what it is handed; each group and each
 * row are sections, because the highlight is theirs to subscribe to; the
 * delete dialog owns its own mutation, and New project behind the plus and
 * Project settings behind a header's cog are the console's project dialog,
 * asked for through `useConsoleDialog`.
 *
 * The filters live here rather than in the menu because this is what they
 * narrow, and in state rather than the URL because they are a view of the
 * navigation, not a destination: the console's URL is the session that is
 * open, and a filter must not change which one that is. The search box is the
 * same kind of thing, applied live — the list is already whole.
 */
export function SessionsSidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolveError = useErrorMessage();
  const { data: sessions, isPending, isError, error } = useSessions();
  const projects = useProjects();
  // Named by the host list, because a session carries only the host's id and
  // an id is not a filter anyone can read. Selected down to plain pairs, which
  // the query keeps by reference across a refetch that changes no name.
  const { data: hosts } = useHosts({
    select: (rows) => rows.map((host) => ({ id: host.id, name: host.name })),
  });
  const [filters, setFilters] = useState<SessionFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const [deleting, setDeleting] = useState<SessionEntity | null>(null);
  const dialogs = useConsoleDialog();

  // A renamed or moved row can land anywhere in a long, grouped list, so
  // both say where it went.
  const rename = useRenameSession({
    onSuccess: (session) => notifySuccess('sessionRenamed', { name: session.name }),
  });
  const move = useMoveSession();
  // One clock for every row's age, ticking once a minute. Every row redraws on
  // the tick, because every age may have moved; that is one render a minute,
  // where a clock read inside each row stopped the ages moving at all.
  const now = useNow(60_000);

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
        agent: agentOptions(all, t('sessions.filters.allAgents'), (agent) =>
          t(`sessions.agents.${agent}` as 'sessions.agents.claude-code'),
        ),
        host: hostOptions(all, hosts, t('sessions.filters.allHosts')),
      }
    : undefined;
  const visible = applyFilters(all, filters).filter((session) => matchesQuery(session, query));
  const dirty = isFiltered(filters);
  const narrowed = dirty || query.trim().length > 0;
  const groups = groupByProject(projects.data ?? [], visible);
  const settled = sessions !== undefined && projects.data !== undefined;
  // The write that failed last, if one did: a menu closes on its pick, so the
  // failure has to stay on screen somewhere the row is. A later write that
  // lands clears it, and so does Dismiss.
  const failure = lastFailure([move, rename]);

  function commitRename() {
    if (!renaming) return;
    const name = renaming.draft.trim();
    const current = all.find((session) => session.id === renaming.id);
    if (name && current && name !== current.name) rename.mutate({ id: renaming.id, name });
    setRenaming(null);
  }

  const rows: SessionRowActions = {
    menuFor,
    onMenuOpenChange: (session, open) => setMenuFor(open ? session.id : null),
    renaming,
    onRenameDraft: (session, draft) => setRenaming({ id: session.id, draft }),
    onRenameCommit: commitRename,
    onRenameCancel: () => setRenaming(null),
    onRename: (session) => setRenaming({ id: session.id, draft: session.name }),
    onMove: (session, projectId) => {
      // The destination's name from the pane that was just picked from.
      const target = projectsForMove(projects.data ?? [], session).find(
        (project) => project.id === projectId,
      );
      const project = target?.isUnassigned ? t('projects.unassigned') : (target?.name ?? '');
      move.mutate(
        { id: session.id, projectId },
        { onSuccess: (moved) => notifySuccess('sessionMoved', { name: moved.name, project }) },
      );
    },
    onDelete: (session) => setDeleting(session),
    moveTargets: (session) => projectsForMove(projects.data ?? [], session),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SessionsSidebarHead
        newSession={<NewSessionButton />}
        projectCount={projects.data?.length}
        filters={filters}
        options={options}
        dirty={dirty}
        chips={options ? activeFilters(filters, options) : []}
        query={query}
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

      {failure.error ? (
        <Alert variant="destructive" className="mx-3 mb-2">
          <AlertDescription>
            {resolveError(failure.error, t('sessions.sidebar.writeFailed')).message}
          </AlertDescription>
          <AlertAction>
            <Button variant="ghost" size="sm" onClick={failure.dismiss}>
              {t('common.dismiss')}
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-5">
        {isError || projects.isError ? (
          // A failed read is not an empty list and not a list still loading:
          // without this branch the skeleton below spun for ever.
          <Alert variant="destructive" className="mx-3 mt-2">
            <AlertDescription>
              {resolveError(error ?? projects.error, t('sessions.sidebar.loadFailed')).message}
            </AlertDescription>
          </Alert>
        ) : isPending || !settled ? (
          <SessionList className="px-3 pt-2">
            <Skeleton className="h-[30px] w-full rounded-sm" />
            <Skeleton className="h-[30px] w-full rounded-sm" />
            <Skeleton className="h-[30px] w-full rounded-sm" />
          </SessionList>
        ) : groups.length === 0 ? (
          // No project at all: the way to one is the plus above and the chip
          // on New session, and the row says so rather than arguing with the
          // pane.
          <div className="px-3 pt-2">
            <EmptyState compact>
              <EmptyState.Header>
                <EmptyState.Description>{t('sessions.sidebar.empty')}</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          </div>
        ) : (
          groups.map(({ project, sessions: members }) => {
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
                now={now}
                onNewSessionHere={(target) =>
                  navigate({ to: '/sessions/new', search: { project: target.id } })
                }
                onSettings={(target) => dialogs.open({ kind: 'project', projectId: target.id })}
                rows={rows}
              />
            );
          })
        )}
      </div>

      <Suspense fallback={null}>
        {deleting ? (
          <DeleteSessionDialog session={deleting} onClose={() => setDeleting(null)} />
        ) : null}
      </Suspense>
    </div>
  );
}
