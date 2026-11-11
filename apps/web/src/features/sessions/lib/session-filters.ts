import { cloudProviderLabel, type SessionEntity } from '@oppenheimer/frontend-consumer';

/** The value every facet starts on, and the one that means "do not narrow". */
export const ALL = 'all';

/**
 * How the list is ordered, in the order the menu lists them: the reader's
 * own, dragged into place (`sidebar-order.ts`), then the artboard's three.
 */
export const SESSION_SORTS = ['custom', 'recent', 'oldest', 'name'] as const;
export type SessionSort = (typeof SESSION_SORTS)[number];

/**
 * What the sidebar's filter menu holds
 * (`product/versions/mvp/design/version1/SessionsConsole.dc.html`): four
 * facets that narrow the list and one order that does not. Every facet is a
 * set of picked values, empty for "do not narrow"; a session shows when it
 * matches any value of every non-empty facet. Which facets take more than
 * one value is `MULTI_FACETS`, the one place that decides it.
 */
export type SessionFilters = Record<SessionFacet, readonly string[]> & { sort: SessionSort };

export const DEFAULT_FILTERS: SessionFilters = {
  project: [],
  repository: [],
  agent: [],
  host: [],
  sort: 'custom',
};

export interface FilterOption {
  value: string;
  label: string;
}

/** The facets, in the order the menu and the chips show them. */
export const FACETS = ['project', 'repository', 'agent', 'host'] as const;
export type SessionFacet = (typeof FACETS)[number];

/**
 * The facets a reader can pick several values of. The others keep one: the
 * menu draws them as a single pick and `pickFacet` replaces rather than adds.
 */
const MULTI_FACETS: ReadonlySet<SessionFacet> = new Set(['repository']);

export function isMultiFacet(facet: SessionFacet): boolean {
  return MULTI_FACETS.has(facet);
}

/**
 * Whether anything is being hidden. Sort is deliberately not part of it: the
 * artboard lights the filter button and draws the chips for what is *missing*
 * from the list, and re-ordering hides nothing.
 */
export function isFiltered(filters: SessionFilters): boolean {
  return FACETS.some((facet) => filters[facet].length > 0);
}

/**
 * A facet after a pick in its list. The "all" row empties it; on a facet
 * that takes several values a row is toggled in or out, on any other it
 * replaces the pick.
 */
export function pickFacet(
  filters: SessionFilters,
  facet: SessionFacet,
  value: string,
  selected: boolean,
): Partial<SessionFilters> {
  if (value === ALL) return { [facet]: [] };
  if (!isMultiFacet(facet)) return { [facet]: [value] };
  const rest = filters[facet].filter((item) => item !== value);
  return { [facet]: selected ? [...rest, value] : rest };
}

/**
 * What a facet's row in the menu says beside its name: the "all" option's
 * label, the one pick's, or `several(count)` past one.
 */
export function facetLabel(
  filters: SessionFilters,
  facet: SessionFacet,
  options: Record<SessionFacet, FilterOption[]>,
  several: (count: number) => string,
): string {
  const picked = filters[facet];
  if (picked.length > 1) return several(picked.length);
  return optionLabel(options, facet, picked[0] ?? ALL);
}

function optionLabel(
  options: Record<SessionFacet, FilterOption[]>,
  facet: SessionFacet,
  value: string,
): string {
  return options[facet].find((option) => option.value === value)?.label ?? value;
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

/**
 * The values a session offers each facet. Repository is every checkout, not
 * the one the agent is launched in.
 */
function facetValues(session: SessionEntity): Record<SessionFacet, readonly string[]> {
  return {
    project: [session.projectId],
    repository: session.checkouts.map((checkout) => checkout.repositoryFullName),
    agent: [session.agent],
    host: [runsOn(session)],
  };
}

/** Narrow, then order. Never mutates the query's array. */
export function applyFilters(sessions: SessionEntity[], filters: SessionFilters): SessionEntity[] {
  return sessions
    .filter((session) => {
      const values = facetValues(session);
      return FACETS.every(
        (facet) =>
          filters[facet].length === 0 ||
          values[facet].some((value) => filters[facet].includes(value)),
      );
    })
    .sort((a, b) => {
      if (filters.sort === 'name') return a.name.localeCompare(b.name);
      // Custom starts from the newest; what the reader placed is put in place after.
      const delta = a.createdAt.getTime() - b.createdAt.getTime();
      return filters.sort === 'oldest' ? delta : -delta;
    });
}

/** A chip under the header: one per picked value, so each can be dropped on its own. */
export interface FilterChipEntry {
  key: SessionFacet;
  value: string;
  label: string;
}

/** The values narrowing right now, for the chip row under the header. */
export function activeFilters(
  filters: SessionFilters,
  options: Record<SessionFacet, FilterOption[]>,
): FilterChipEntry[] {
  return FACETS.flatMap((key) =>
    filters[key].map((value) => ({ key, value, label: optionLabel(options, key, value) })),
  );
}

/** The filters with one chip's value taken off. */
export function withoutChip(filters: SessionFilters, chip: FilterChipEntry): SessionFilters {
  return { ...filters, [chip.key]: filters[chip.key].filter((value) => value !== chip.value) };
}

/** Where a session runs, as one key a filter compares: its host, or `cloud:<vendor>`. */
function runsOn(session: Pick<SessionEntity, 'hostId' | 'cloud'>): string {
  return session.cloud ? `cloud:${session.cloud.provider}` : (session.hostId ?? '');
}
