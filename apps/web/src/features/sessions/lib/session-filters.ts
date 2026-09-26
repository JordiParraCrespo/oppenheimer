import type { SessionEntity } from '@oppenheimer/frontend-consumer';

/** The value every facet starts on, and the one that means "do not narrow". */
export const ALL = 'all';

/** How the list is ordered, in the order the artboard's menu lists them. */
export type SessionSort = 'recent' | 'oldest' | 'name';

/**
 * What the sidebar's filter menu holds
 * (`product/versions/mvp/design/version1/SessionsConsole.dc.html`): three
 * facets that narrow the list and one order that does not.
 */
export interface SessionFilters {
  project: string;
  repository: string;
  agent: string;
  host: string;
  sort: SessionSort;
}

export const DEFAULT_FILTERS: SessionFilters = {
  project: ALL,
  repository: ALL,
  agent: ALL,
  host: ALL,
  sort: 'recent',
};

/** One row of a facet's submenu. */
export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Whether anything is being hidden. Sort is deliberately not part of it: the
 * artboard lights the filter button and draws the chips for what is *missing*
 * from the list, and re-ordering hides nothing.
 */
/** The facets, in the order the menu and the chips show them. */
export const FACETS = ['project', 'repository', 'agent', 'host'] as const;
export type SessionFacet = (typeof FACETS)[number];

export function isFiltered(filters: SessionFilters): boolean {
  return FACETS.some((facet) => filters[facet] !== ALL);
}

export function projectOptions(
  projects: { id: string; name: string }[] | undefined,
  allLabel: string,
): FilterOption[] {
  return [
    { value: ALL, label: allLabel },
    ...(projects ?? []).map((project) => ({ value: project.id, label: project.name })),
  ];
}

/** `owner/repo` is how a session names its repository; the menu wants `repo`. */
export function repositoryLabel(repository: string): string {
  return repository.slice(repository.lastIndexOf('/') + 1) || repository;
}

function distinct(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/**
 * The facets are built from the sessions on screen rather than from a
 * catalogue: a repository nothing is running in is not a filter worth
 * offering, and the artboard's lists are exactly the repositories, agents and
 * hosts its rows carry.
 */
export function repositoryOptions(sessions: SessionEntity[], allLabel: string): FilterOption[] {
  return [
    { value: ALL, label: allLabel },
    // Every checkout, not one per session: a session is several repositories
    // now, and a repository is worth filtering by whether or not it is the one
    // the agent happens to be launched in.
    ...distinct(
      sessions.flatMap((session) =>
        session.checkouts.map((checkout) => checkout.repositoryFullName),
      ),
    ).map((repository) => ({
      value: repository,
      label: repositoryLabel(repository),
    })),
  ];
}

export function agentOptions(
  sessions: SessionEntity[],
  allLabel: string,
  label: (agent: string) => string,
): FilterOption[] {
  return [
    { value: ALL, label: allLabel },
    ...distinct(sessions.map((session) => session.agent)).map((agent) => ({
      value: agent,
      label: label(agent),
    })),
  ];
}

/**
 * Hosts are named by the host list, not by the sessions: a session carries
 * only the id, and an id is not a filter anyone can read. A host the list has
 * not answered for yet keeps its id, which is still better than dropping the
 * row and pretending the session has no host.
 */
export function hostOptions(
  sessions: SessionEntity[],
  hosts: { id: string; name: string }[] | undefined,
  allLabel: string,
): FilterOption[] {
  const names = new Map(hosts?.map((host) => [host.id, host.name]));
  return [
    { value: ALL, label: allLabel },
    ...distinct(sessions.map((session) => session.hostId)).map((hostId) => ({
      value: hostId,
      label: names.get(hostId) ?? hostId,
    })),
  ];
}

/** Narrow, then order. Never mutates the query's array. */
export function applyFilters(sessions: SessionEntity[], filters: SessionFilters): SessionEntity[] {
  return sessions
    .filter(
      (session) =>
        (filters.project === ALL || session.projectId === filters.project) &&
        (filters.repository === ALL ||
          session.checkouts.some(
            (checkout) => checkout.repositoryFullName === filters.repository,
          )) &&
        (filters.agent === ALL || session.agent === filters.agent) &&
        (filters.host === ALL || session.hostId === filters.host),
    )
    .sort((a, b) => {
      if (filters.sort === 'name') return a.name.localeCompare(b.name);
      const delta = a.createdAt.getTime() - b.createdAt.getTime();
      return filters.sort === 'oldest' ? delta : -delta;
    });
}

/** The facets that are narrowing right now, for the chip row under the header. */
export function activeFilters(
  filters: SessionFilters,
  options: Record<SessionFacet, FilterOption[]>,
): { key: SessionFacet; label: string }[] {
  return FACETS.filter((key) => filters[key] !== ALL).map((key) => ({
    key,
    label: options[key].find((option) => option.value === filters[key])?.label ?? filters[key],
  }));
}
