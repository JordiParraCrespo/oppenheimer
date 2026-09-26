import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';

/**
 * The sidebar's groups: one per project, newest project first as the API
 * lists them, each holding the sessions that belong to it — so an empty
 * project is still a group, with the empty row inside it, and a session whose
 * project the list does not hold (archived meanwhile, or not yet loaded) goes
 * last under no header rather than vanishing.
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
 * Where a session may move: every other project that holds every repository
 * it checked out, which is the rule `POST /sessions/:id/move` enforces and the
 * dialog's "only projects that include …" line states.
 */
export function projectsForMove(
  projects: readonly ProjectEntity[],
  session: SessionEntity,
): ProjectEntity[] {
  return projects.filter(
    (project) =>
      project.id !== session.projectId &&
      session.checkouts.every((checkout) =>
        project.includesRepository(Number(checkout.githubRepoId)),
      ),
  );
}

/** A live search over the row's name: what the sidebar's search box narrows. */
export function matchesQuery(session: SessionEntity, query: string): boolean {
  const term = query.trim().toLowerCase();
  return term ? session.name.toLowerCase().includes(term) : true;
}
