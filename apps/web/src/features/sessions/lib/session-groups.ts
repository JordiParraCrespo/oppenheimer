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
 * project the project filter picked stays to say it has no match. A project
 * whose only sessions are pinned is not drawn: they are drawn above the
 * projects, and are not in `occupied`.
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
function emptyListMessage(
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
 * The project a move would leave the sessions in, or null when they are not
 * all in one. A move lists every project, this one too: ticked and not
 * choosable, so the reader sees where the sessions are (a pinned row is drawn
 * above the projects, not under its own). A project is metadata — a session's
 * directory and branch never name it — so any other project can take them
 * (`product/versions/mvp/10-api-modules-and-data-model.md`).
 */
export function currentProjectOf(sessions: readonly SessionEntity[]): string | null {
  const first = sessions[0]?.projectId;
  if (!first) return null;
  return sessions.every((session) => session.projectId === first) ? first : null;
}

/**
 * A move's rows, for both the row's menu and the selection bar: every
 * project, the one the sessions are in (`current`) noted, ticked by the
 * caller's `value`, and not choosable.
 */
export function moveProjectOptions(
  t: TFunction,
  projects: readonly { id: string; name: string; isUnassigned?: boolean }[],
  current: string | null,
): { value: string; label: string; description?: string; disabled?: boolean }[] {
  return projects.map((project) => ({
    value: project.id,
    label: project.isUnassigned ? t('projects.unassigned') : project.name,
    ...(project.id === current
      ? { description: t('sessions.sidebar.moveCurrent'), disabled: true }
      : {}),
  }));
}

/** A live search over the row's name: what the sidebar's search box narrows. */
export function matchesQuery(session: SessionEntity, query: string): boolean {
  const term = query.trim().toLowerCase();
  return term ? session.name.toLowerCase().includes(term) : true;
}

/**
 * What the list draws below Pinned, how many sessions that is with the pinned
 * ones, and what it says instead when it draws nothing. Under Pinned only no
 * project is drawn, and an empty Pinned says how to pin a session.
 */
export function sidebarList<T extends ProjectGroup>(
  t: TFunction,
  {
    pinnedOnly,
    groups,
    occupied,
    picked,
    pinned,
    hiddenCount,
    narrowed,
    query,
  }: {
    pinnedOnly: boolean;
    groups: readonly T[];
    occupied: ReadonlySet<string>;
    picked: string | null;
    pinned: readonly SessionEntity[];
    hiddenCount: number;
    narrowed: boolean;
    query: string;
  },
): { shown: T[]; count: number; empty: string | null } {
  const shown = pinnedOnly ? [] : shownGroups(groups, occupied, picked);
  const count = pinned.length + shown.reduce((sum, group) => sum + group.sessions.length, 0);
  const empty =
    pinnedOnly && pinned.length === 0 && !narrowed && (groups.length > 0 || hiddenCount > 0)
      ? t('sessions.sidebar.noPinned')
      : emptyListMessage(t, { groups, shown, pinned, hiddenCount, narrowed, query });
  return { shown, count, empty };
}
