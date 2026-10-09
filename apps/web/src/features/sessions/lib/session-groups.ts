import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';

/**
 * The sidebar's groups: one per project, in the order given (the reader's,
 * `orderProjects`), each holding the sessions that belong to it — so an empty project is still a group, with the
 * empty row inside it, and a session whose project the list does not hold
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
  /** Which project a session is drawn in: its own, or where a drop is still moving it. */
  projectOf: (session: SessionEntity) => string = (session) => session.projectId,
): ProjectGroup[] {
  const byProject = new Map<string, SessionEntity[]>(projects.map((project) => [project.id, []]));
  const orphans: SessionEntity[] = [];
  for (const session of sessions) {
    const list = byProject.get(projectOf(session));
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
