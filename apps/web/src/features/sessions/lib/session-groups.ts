import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';

/**
 * The sidebar's groups: one per project, in the order given (the reader's,
 * `orderProjects`), each holding the sessions that belong to it — so an empty project is still a group,
 * which `shownGroups` leaves undrawn, and a session whose project the list does not hold
 * (archived meanwhile, or not yet loaded) goes last under no header rather
 * than vanishing.
 */
export interface ProjectGroup {
  project: ProjectEntity | null;
  sessions: SessionEntity[];
}

export function groupByProject(
  projects: readonly ProjectEntity[],
  sessions: readonly SessionEntity[],
): ProjectGroup[] {
  const byProject = new Map<string, SessionEntity[]>(projects.map((project) => [project.id, []]));
  const orphans: SessionEntity[] = [];
  for (const session of sessions) {
    const list = byProject.get(session.projectId);
    if (list) list.push(session);
    else orphans.push(session);
  }
  const groups: ProjectGroup[] = projects.map((project) => ({
    project,
    sessions: byProject.get(project.id) ?? [],
  }));
  if (orphans.length) groups.push({ project: null, sessions: orphans });
  return groups;
}

/**
 * The groups worth drawing: a project with no session is noise, so it goes.
 * A group stays while one of `occupied`'s sessions is its own, so the group a
 * drag lifts its last session out of holds still under the pointer, and the
 * project the project filter picked stays to say it has no match.
 */
export function shownGroups<T extends ProjectGroup>(
  groups: readonly T[],
  occupied: ReadonlySet<string>,
  pickedProject: string | null,
): T[] {
  return groups.filter(
    (group) =>
      group.sessions.length > 0 ||
      (group.project && (occupied.has(group.project.id) || group.project.id === pickedProject)),
  );
}

/**
 * What an empty list or group says: nothing yet, or nothing that matches the
 * search, or nothing that matches the filters.
 */
export function emptyMessage(t: TFunction, narrowed: boolean, query: string): string {
  const term = query.trim();
  if (!narrowed) return t('sessions.sidebar.emptyProject');
  return term ? t('sessions.sidebar.noMatches', { query: term }) : t('sessions.filters.noMatches');
}

/**
 * What the sidebar says in place of its list, or null when it draws one: no
 * project at all, nothing that matches the search or the filters, every
 * project hidden, or no session in any project.
 */
export function emptyListMessage(
  t: TFunction,
  {
    groups,
    shown,
    pinned,
    hiddenCount,
    narrowed,
    query,
  }: {
    groups: readonly ProjectGroup[];
    shown: readonly ProjectGroup[];
    pinned: readonly SessionEntity[];
    hiddenCount: number;
    narrowed: boolean;
    query: string;
  },
): string | null {
  if (groups.length === 0 && hiddenCount === 0) return t('sessions.sidebar.empty');
  if (shown.length > 0 || pinned.length > 0) return null;
  if (narrowed) return emptyMessage(t, true, query);
  return groups.length === 0 ? t('sessions.sidebar.allHidden') : t('sessions.sidebar.noSessions');
}

/**
 * Where a session may move: every other project. A project is metadata — a
 * session's directory and branch never name it — so there is no rule about
 * which repositories it holds (`product/versions/mvp/10-api-modules-and-data-model.md`).
 */
export function projectsForMove(
  projects: readonly ProjectEntity[],
  session: SessionEntity,
): ProjectEntity[] {
  return projects.filter((project) => project.id !== session.projectId);
}

/** A live search over the row's name: what the sidebar's search box narrows. */
export function matchesQuery(session: SessionEntity, query: string): boolean {
  const term = query.trim().toLowerCase();
  return term ? session.name.toLowerCase().includes(term) : true;
}
