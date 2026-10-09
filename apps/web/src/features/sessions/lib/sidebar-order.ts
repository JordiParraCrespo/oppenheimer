import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';

/**
 * The reader's own order for the sidebar, kept on this device the way the
 * rail's is (`rail-order.ts`): the projects' ids in the order they were
 * dragged into, and the sessions' ids in one list across every project, so
 * a session keeps its place among its project's others wherever it moves.
 * Which project a session is in is the API's, not this.
 */
export interface SidebarOrder {
  projects: readonly string[];
  sessions: readonly string[];
}

export const SIDEBAR_ORDER_KEY = 'oppenheimer.sidebar.order';

/** The `SortableGroup` the projects sit in; a project's sessions sit in one named by its id. */
export const PROJECTS_GROUP = 'projects';

/** A project's item id: its own id names the group its sessions sit in, and ids are one namespace. */
export function projectItemId(projectId: string): string {
  return `project:${projectId}`;
}

export function projectIdOf(itemId: string): string {
  return itemId.slice('project:'.length);
}

const EMPTY: SidebarOrder = { projects: [], sessions: [] };

function ids(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string'))]
    : [];
}

/** Anything unreadable, or storage switched off, is no order: the API's. */
export function storedSidebarOrder(): SidebarOrder {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(SIDEBAR_ORDER_KEY) ?? 'null');
    if (!stored || typeof stored !== 'object') return EMPTY;
    const { projects, sessions } = stored as Record<string, unknown>;
    return { projects: ids(projects), sessions: ids(sessions) };
  } catch {
    return EMPTY;
  }
}

export function rememberSidebarOrder(order: SidebarOrder) {
  try {
    window.localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(order));
  } catch {
    // Private browsing or a full quota: the order holds until the page reloads.
  }
}

/**
 * `items` in the stored order: the ones never placed first, in the order
 * they came (a project or a session made since the last drag lands on top,
 * where the reader looks for it), then the placed ones in their place.
 */
function inStoredOrder<T>(
  items: readonly T[],
  stored: readonly string[],
  idOf: (item: T) => string,
): T[] {
  const rank = new Map(stored.map((id, index) => [id, index]));
  const fresh = items.filter((item) => !rank.has(idOf(item)));
  const placed = items
    .filter((item) => rank.has(idOf(item)))
    .sort((a, b) => (rank.get(idOf(a)) ?? 0) - (rank.get(idOf(b)) ?? 0));
  return [...fresh, ...placed];
}

/**
 * The projects in the reader's order. Without one it is the API's, the
 * workspace's Unassigned project first.
 */
export function orderProjects(
  projects: readonly ProjectEntity[],
  stored: readonly string[],
): ProjectEntity[] {
  const defaults = [
    ...projects.filter((project) => project.isUnassigned),
    ...projects.filter((project) => !project.isUnassigned),
  ];
  return inStoredOrder(defaults, stored, (project) => project.id);
}

/** A project's sessions in the reader's order, from the order the sort gave them. */
export function orderSessions(
  sessions: readonly SessionEntity[],
  stored: readonly string[],
): SessionEntity[] {
  return inStoredOrder(sessions, stored, (session) => session.id);
}
