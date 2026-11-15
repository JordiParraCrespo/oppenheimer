import type { ProjectEntity } from '../projects/project.entity';
import type { SessionEntity } from './session.entity';

/**
 * A session list's groups, the console's sidebar and the phone's Sessions tab
 * alike: one per project, in the order given, each holding the sessions that
 * belong to it. An empty project is still a group, which a list may leave
 * undrawn, and a session whose project the list does not hold (archived
 * meanwhile, or not yet loaded) goes last under no header rather than
 * vanishing.
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

/** A live search over the row's name: what a session list's search box narrows. */
export function matchesQuery(session: SessionEntity, query: string): boolean {
  const term = query.trim().toLowerCase();
  return term ? session.name.toLowerCase().includes(term) : true;
}
