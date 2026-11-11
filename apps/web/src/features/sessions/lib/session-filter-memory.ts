import { z } from 'zod';
import {
  ALL,
  DEFAULT_FILTERS,
  type FilterOption,
  type SessionFacet,
  type SessionFilters,
} from './session-filters';

/**
 * The sidebar's filters as the reader last left them, kept on this device
 * like Plan's (`plan-filter-memory.ts`) and the sidebar's pins and folds: a
 * filter is the reader's view, so the API never hears of it.
 */
export const SESSION_FILTERS_KEY = 'oppenheimer.sidebar.filters';

const picks = z.array(z.string()).catch([]);

const SCHEMA = z.object({
  project: picks,
  repository: picks,
  agent: picks,
  host: picks,
  sort: z.enum(['custom', 'recent', 'oldest', 'name']).catch(DEFAULT_FILTERS.sort),
});

/** What storage holds, field by field: an unreadable field is its default, not the whole set. */
export function storedSessionFilters(): SessionFilters {
  try {
    const parsed = SCHEMA.safeParse(
      JSON.parse(window.localStorage.getItem(SESSION_FILTERS_KEY) ?? 'null'),
    );
    return parsed.success ? parsed.data : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

/** Keep the filters, already serialised, for the next visit. */
export function rememberSessionFilters(serialised: string) {
  try {
    window.localStorage.setItem(SESSION_FILTERS_KEY, serialised);
  } catch {
    // Private browsing or a full quota: the filters hold until the page reloads.
  }
}

/**
 * The filters with every pick the menu no longer offers taken off: a deleted
 * project, a host gone, a repository nothing runs in. A remembered pick that
 * names nothing on screen would hide every session behind a chip that reads
 * as an id; the facet reads "all" instead.
 */
export function withinOptions(
  filters: SessionFilters,
  options: Record<SessionFacet, FilterOption[]>,
): SessionFilters {
  const offered = (facet: SessionFacet) =>
    filters[facet].filter(
      (value) => value !== ALL && options[facet].some((option) => option.value === value),
    );
  return {
    project: offered('project'),
    repository: offered('repository'),
    agent: offered('agent'),
    host: offered('host'),
    sort: filters.sort,
  };
}
