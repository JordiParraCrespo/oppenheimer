import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';

/**
 * The projects the reader hid from the sidebar, kept on this device like the
 * folds (`folded-groups.ts`): their ids. A hidden project's group and its
 * sessions are not drawn, unless the project filter picks it or one of its
 * sessions is pinned. Hiding is the reader's, so the API never hears of it.
 */
export const HIDDEN_PROJECTS_KEY = 'oppenheimer.sidebar.hidden';

/** `hidden` with `id` hidden, or shown. */
export function withHidden(hidden: readonly string[], id: string, shown: boolean): string[] {
  const rest = hidden.filter((hiddenId) => hiddenId !== id);
  return shown ? rest : [...rest, id];
}

/**
 * What the sidebar lists once the hidden projects are taken out: which
 * projects are drawn (a hidden one is, while the project filter picks it),
 * the sessions left to group, and how many projects are hidden.
 */
export function listedProjects(
  projects: readonly ProjectEntity[],
  sessions: readonly SessionEntity[],
  hidden: readonly string[],
  picked: string | null,
) {
  const listed = (projectId: string) => !hidden.includes(projectId) || projectId === picked;
  return {
    listed,
    sessions: sessions.filter((session) => listed(session.projectId)),
    hiddenCount: projects.filter((project) => hidden.includes(project.id)).length,
  };
}
