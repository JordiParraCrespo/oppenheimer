import {
  Button,
  EmptyState,
  IconButton,
  SessionItem,
  SessionList,
  SidebarEmptyRow,
  SidebarProjectHeader,
  SidebarSearch,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Plus, Settings } from '@oppenheimer/design-system-web/icons';
import type { ProjectEntity, SessionEntity, SessionGroup } from '@oppenheimer/frontend-consumer';
import {
  useHosts,
  useMoveSession,
  useProjects,
  useRenameSession,
  useSessions,
} from '@oppenheimer/frontend-consumer/react';
import { compactAge } from '@oppenheimer/frontend-web';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionFilterChips } from '../components/session-filter-chips';
import { SessionRowMenu } from '../components/session-row-menu';
import { SessionsFilterMenu } from '../components/sessions-filter-menu';
import { DeleteSessionDialog } from '../dialogs/delete-session';
import { ProjectDialog } from '../dialogs/project';
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

/**
 * How a session's **group** reads as a dot.
 *
 * The group is what the sidebar shows because it is organised by what needs
 * you rather than by what a process is doing
 * (`product/versions/mvp/05-screens.md`): a session that failed, one whose
 * agent has been blocked for thirty seconds and one whose launch has sat
 * unready for a minute all want the same glance. `working` is the pulsing dot
 * of a session with something happening on a machine elsewhere.
 *
 * One dot is not the group's to give: a session the host has not built yet
 * reads as `idle`, because nothing needs you about it — but the artboard draws
 * it joining the list at once with a pulsing grey glyph, and that is the
 * **lifecycle** speaking, not the group. {@link dotFor} puts the two together.
 */
const DOT: Record<SessionGroup, 'running' | 'idle' | 'failed' | 'pending' | 'completed'> = {
  working: 'running',
  'waiting-on-you': 'failed',
  'ready-for-review': 'running',
  landing: 'pending',
  idle: 'idle',
  resolved: 'completed',
};

/** The dot a row shows: provisioning first, then what needs you. */
function dotFor(session: SessionEntity) {
  return session.isProvisioning ? 'pending' : DOT[session.state];
}

/** Which dialog is open, and about what. */
type Dialog =
  | { kind: 'new-project' }
  | { kind: 'project'; project: ProjectEntity }
  | { kind: 'delete'; session: SessionEntity };

/**
 * The console's sidebar body: New session, then the sessions grouped by
 * project (`product/versions/mvp/12-projects-on-the-console.md`).
 *
 * The product is the list, so the list is the navigation. It is a feature
 * rather than kit because it reads product hooks; the brand row above it and
 * the account menu below it are the shell's, and the rail beside it is its
 * sibling section.
 *
 * Three reads: the sessions (the rows), the projects (the groups, in the
 * order the API lists them) and the hosts (a filter facet's names). Two
 * mutations live here because the row that triggers them is a component that
 * may not: a rename commits from the inline input, a move from the row menu's
 * pane. Delete and the project dialog own theirs.
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
  const { data: sessions, isPending } = useSessions();
  const projects = useProjects();
  // Named by the host list, because a session carries only the host's id and
  // an id is not a filter anyone can read.
  const { data: hosts } = useHosts();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [filters, setFilters] = useState<SessionFilters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const rename = useRenameSession();
  const move = useMoveSession();

  const all = sessions ?? [];
  const options = {
    project: projectOptions(projects.data, t('sessions.filters.allProjects')),
    repository: repositoryOptions(all, t('sessions.filters.allRepositories')),
    agent: agentOptions(all, t('sessions.filters.allAgents'), (agent) =>
      t(`sessions.agents.${agent}` as 'sessions.agents.claude-code'),
    ),
    host: hostOptions(all, hosts, t('sessions.filters.allHosts')),
  };
  const visible = applyFilters(all, filters).filter((session) => matchesQuery(session, query));
  const dirty = isFiltered(filters);
  const chips = activeFilters(filters, options);
  const groups = groupByProject(projects.data ?? [], visible);
  const settled = sessions !== undefined && projects.data !== undefined;

  function commitRename() {
    if (!renaming) return;
    const name = renaming.draft.trim();
    const current = all.find((session) => session.id === renaming.id);
    if (name && current && name !== current.name) rename.mutate({ id: renaming.id, name });
    setRenaming(null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2.5">
        <Button size="sm" block render={<Link to="/sessions/new" />}>
          {t('nav.newSession')}
        </Button>
      </div>

      <div className="flex items-center gap-2 px-3 pt-0.5 pb-1.5">
        <span className="min-w-0 flex-1 text-[11px] tracking-[0.04em] text-fg-muted uppercase">
          {t('sessions.sidebar.projects')}
        </span>
        {/* No count until the list has settled: a zero under a request that
            has not answered reads as "you have none", which is a different
            thing from "not yet known". */}
        {projects.data ? (
          <span className="figures text-[11px] text-fg-muted">{projects.data.length}</span>
        ) : null}
        <IconButton
          size="xs"
          variant="quiet"
          aria-label={t('sessions.sidebar.newProject')}
          onClick={() => setDialog({ kind: 'new-project' })}
        >
          <Plus />
        </IconButton>
        {sessions ? (
          <SessionsFilterMenu
            filters={filters}
            options={options}
            dirty={dirty}
            onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
            onClear={() => setFilters((current) => ({ ...DEFAULT_FILTERS, sort: current.sort }))}
          />
        ) : null}
      </div>

      <SidebarSearch
        value={query}
        onValueChange={setQuery}
        placeholder={t('sessions.sidebar.search')}
        aria-label={t('sessions.sidebar.search')}
        clearLabel={t('sessions.sidebar.clearSearch')}
      />

      {dirty ? (
        <SessionFilterChips
          chips={chips}
          onClear={(key) => setFilters((current) => ({ ...current, [key]: ALL }))}
        />
      ) : null}

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-5">
        {isPending || !settled ? (
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
          <>
            {groups.map(({ project, sessions: rows }) => {
              const key = project?.id ?? 'unfiled';
              const open = !closed.includes(key);
              return (
                <div key={key} className="mt-1.5 flex flex-col">
                  <SidebarProjectHeader
                    name={project?.name ?? t('sessions.sidebar.unfiled')}
                    count={rows.length}
                    open={open}
                    onOpenChange={(next) =>
                      setClosed((current) =>
                        next ? current.filter((id) => id !== key) : [...current, key],
                      )
                    }
                    current={rows.some((session) => pathname === `/sessions/${session.id}`)}
                    actions={
                      project ? (
                        <>
                          <IconButton
                            size="xs"
                            variant="quiet"
                            aria-label={t('sessions.sidebar.newSessionHere', {
                              name: project.name,
                            })}
                            onClick={() =>
                              navigate({ to: '/sessions/new', search: { project: project.id } })
                            }
                          >
                            <Plus />
                          </IconButton>
                          <IconButton
                            size="xs"
                            variant="quiet"
                            aria-label={t('sessions.sidebar.projectSettings', {
                              name: project.name,
                            })}
                            onClick={() => setDialog({ kind: 'project', project })}
                          >
                            <Settings />
                          </IconButton>
                        </>
                      ) : undefined
                    }
                  />
                  {!open ? null : rows.length === 0 ? (
                    <SidebarEmptyRow>
                      {query || dirty
                        ? t('sessions.sidebar.noMatches', { query })
                        : t('sessions.sidebar.emptyProject')}{' '}
                      {project && !query && !dirty ? (
                        <Link to="/sessions/new" search={{ project: project.id }}>
                          {t('sessions.sidebar.startOne')}
                        </Link>
                      ) : null}
                    </SidebarEmptyRow>
                  ) : (
                    <SessionList className="px-3">
                      {rows.map((session) => (
                        <SessionRow
                          key={session.id}
                          session={session}
                          pathname={pathname}
                          menuOpen={menuFor === session.id}
                          onMenuOpenChange={(next) => setMenuFor(next ? session.id : null)}
                          rename={
                            renaming?.id === session.id
                              ? {
                                  value: renaming.draft,
                                  onValueChange: (draft) => setRenaming({ id: session.id, draft }),
                                  onCommit: commitRename,
                                  onCancel: () => setRenaming(null),
                                  label: t('sessions.sidebar.renameLabel'),
                                }
                              : undefined
                          }
                          onRename={() => setRenaming({ id: session.id, draft: session.name })}
                          onMove={(projectId) => move.mutate({ id: session.id, projectId })}
                          onDelete={() => setDialog({ kind: 'delete', session })}
                          moveTargets={projectsForMove(projects.data ?? [], session)}
                        />
                      ))}
                    </SessionList>
                  )}
                </div>
              );
            })}
            {dirty && visible.length === 0 ? (
              <div className="px-3 pt-2">
                <EmptyState compact>
                  <EmptyState.Description>{t('sessions.filters.noMatches')}</EmptyState.Description>
                </EmptyState>
              </div>
            ) : null}
          </>
        )}
      </div>

      {dialog?.kind === 'new-project' ? (
        <ProjectDialog onClose={() => setDialog(null)} onSaved={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'project' ? (
        <ProjectDialog
          project={dialog.project}
          sessionCount={all.filter((session) => session.projectId === dialog.project.id).length}
          onClose={() => setDialog(null)}
          onSaved={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <DeleteSessionDialog session={dialog.session} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

/**
 * One row. The age is derived on render rather than held: `compactAge` returns
 * the unit and the count, and the words are ours to translate — `null` is
 * "less than a minute", which the artboard leaves blank rather than labelling.
 * The ellipsis is the row's `action`, shown on hover and while its menu is
 * open; the inline rename replaces the name and hides both.
 */
function SessionRow({
  session,
  pathname,
  menuOpen,
  onMenuOpenChange,
  rename,
  onRename,
  onMove,
  onDelete,
  moveTargets,
}: {
  session: SessionEntity;
  pathname: string;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  rename?: React.ComponentProps<typeof SessionItem>['rename'];
  onRename: () => void;
  onMove: (projectId: string) => void;
  onDelete: () => void;
  moveTargets: ProjectEntity[];
}) {
  const { t } = useTranslation();
  const age = compactAge(session.createdAt);

  return (
    <SessionItem
      name={session.name}
      age={age ? t(`common.relative.${age.unit}`, { count: age.count }) : undefined}
      state={dotFor(session)}
      active={pathname === `/sessions/${session.id}`}
      render={<Link to="/sessions/$sessionId" params={{ sessionId: session.id }} />}
      menuOpen={menuOpen}
      rename={rename}
      action={
        <SessionRowMenu
          open={menuOpen}
          onOpenChange={onMenuOpenChange}
          onRename={onRename}
          onMove={onMove}
          onDelete={onDelete}
          projects={moveTargets.map((project) => ({ id: project.id, name: project.name }))}
        />
      }
    />
  );
}
