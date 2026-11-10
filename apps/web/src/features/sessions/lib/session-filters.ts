import { cloudProviderLabel, type SessionEntity } from '@oppenheimer/frontend-consumer';

/** The value every facet starts on, and the one that means "do not narrow". */
export const ALL = 'all';

/**
 * How the list is ordered, in the order the menu lists them: the reader's
 * own, dragged into place (`sidebar-order.ts`), then the artboard's three.
 */
export type SessionSort = 'custom' | 'recent' | 'oldest' | 'name';

/**
 * What the sidebar's filter menu holds
 * (`product/versions/mvp/design/version1/SessionsConsole.dc.html`): four
 * facets that narrow the list and one order that does not. Repository is a
 * set, empty for all of them: a session shows when any of its checkouts is
 * one of the picked repositories.
 */
export interface SessionFilters {
  project: string;
  repository: readonly string[];
  agent: string;
  host: string;
  sort: SessionSort;
}

export const DEFAULT_FILTERS: SessionFilters = {
  project: ALL,
  repository: [],
  agent: ALL,
  host: ALL,
  sort: 'custom',
};

export interface FilterOption {
  value: string;
  label: string;
}

/** The facets, in the order the menu and the chips show them. */
const FACETS = ['project', 'repository', 'agent', 'host'] as const;
export type SessionFacet = (typeof FACETS)[number];

/**
 * Whether anything is being hidden. Sort is deliberately not part of it: the
 * artboard lights the filter button and draws the chips for what is *missing*
 * from the list, and re-ordering hides nothing.
 */
export function isFiltered(filters: SessionFilters): boolean {
  return FACETS.some((facet) => isNarrowing(filters, facet));
}

function isNarrowing(filters: SessionFilters, facet: SessionFacet): boolean {
  return facet === 'repository' ? filters.repository.length > 0 : filters[facet] !== ALL;
}

/**
 * The Repository facet after a pick in its list: "All repositories" empties
 * the set, any other row is toggled in or out of it.
 */
export function toggleRepository(
  picked: readonly string[],
  repository: string,
  selected: boolean,
): string[] {
  if (repository === ALL) return [];
  const rest = picked.filter((item) => item !== repository);
  return selected ? [...rest, repository] : rest;
}

/** The set the Repository list checks: "All repositories" while none is picked. */
export function checkedRepositories(picked: readonly string[]): readonly string[] {
  return picked.length > 0 ? picked : [ALL];
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
function repositoryLabel(repository: string): string {
  return repository.slice(repository.lastIndexOf('/') + 1) || repository;
}

function distinct<T extends string>(values: T[]): T[] {
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
    // Every checkout, not one per session: a repository is worth filtering by
    // whether or not it is the one the agent happens to be launched in.
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
  label: (agent: SessionEntity['agent']) => string,
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
    // A cloud session runs at its vendor, which stands in the host's place.
    ...distinct(sessions.map(runsOn)).map((place) => {
      const provider = sessions.find((session) => runsOn(session) === place)?.cloud?.provider;
      return {
        value: place,
        label: provider ? cloudProviderLabel(provider) : (names.get(place) ?? place),
      };
    }),
  ];
}

/** Narrow, then order. Never mutates the query's array. */
export function applyFilters(sessions: SessionEntity[], filters: SessionFilters): SessionEntity[] {
  return sessions
    .filter(
      (session) =>
        (filters.project === ALL || session.projectId === filters.project) &&
        (filters.repository.length === 0 ||
          session.checkouts.some((checkout) =>
            filters.repository.includes(checkout.repositoryFullName),
          )) &&
        (filters.agent === ALL || session.agent === filters.agent) &&
        (filters.host === ALL || runsOn(session) === filters.host),
    )
    .sort((a, b) => {
      if (filters.sort === 'name') return a.name.localeCompare(b.name);
      // Custom starts from the newest; what the reader placed is put in place after.
      const delta = a.createdAt.getTime() - b.createdAt.getTime();
      return filters.sort === 'oldest' ? delta : -delta;
    });
}

/**
 * A chip under the header: one per narrowing facet, and one per picked
 * repository so each can be dropped on its own. `value` is that repository.
 */
export interface FilterChipEntry {
  key: SessionFacet;
  value: string;
  label: string;
}

/** The facets that are narrowing right now, for the chip row under the header. */
export function activeFilters(
  filters: SessionFilters,
  options: Record<SessionFacet, FilterOption[]>,
): FilterChipEntry[] {
  const labelOf = (key: SessionFacet, value: string) =>
    options[key].find((option) => option.value === value)?.label ?? value;
  return FACETS.flatMap((key): FilterChipEntry[] => {
    if (key === 'repository') {
      return filters.repository.map((value) => ({ key, value, label: labelOf(key, value) }));
    }
    const value = filters[key];
    return value === ALL ? [] : [{ key, value, label: labelOf(key, value) }];
  });
}

/** The filters with one chip's narrowing taken off. */
export function withoutChip(filters: SessionFilters, chip: FilterChipEntry): SessionFilters {
  return chip.key === 'repository'
    ? { ...filters, repository: toggleRepository(filters.repository, chip.value, false) }
    : { ...filters, [chip.key]: ALL };
}

/** Where a session runs, as one key a filter compares: its host, or `cloud:<vendor>`. */
function runsOn(session: Pick<SessionEntity, 'hostId' | 'cloud'>): string {
  return session.cloud ? `cloud:${session.cloud.provider}` : (session.hostId ?? '');
}
