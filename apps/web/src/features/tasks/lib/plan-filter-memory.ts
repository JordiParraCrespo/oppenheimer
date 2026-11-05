import { searchText } from '@oppenheimer/frontend-web';
import { z } from 'zod';

/**
 * Plan's filters as each view last had them, kept on this device so a view
 * comes back filtered the way the reader left it, as a Notion view does. The
 * board keeps its project and milestone, Milestones its project; each view
 * its own.
 *
 * The address stays the source of truth: a view visited with no filter in
 * its address is sent to the one it remembers (`restorePlanFilters`), and a
 * view visited with one remembers it, so a shared link or a timeline row
 * becomes the view's filter. Clear remembers nothing, so it sticks.
 */
export type PlanFilterView = 'board' | 'milestones';

export const PLAN_FILTERS_KEY = 'oppenheimer.plan.filters';

const filtersSchema = z.object({ project: searchText, milestone: searchText });
export type PlanFilters = z.infer<typeof filtersSchema>;

/** Which keys of the address each view's filter is. */
const KEYS = {
  board: ['project', 'milestone'],
  milestones: ['project'],
} as const satisfies Record<PlanFilterView, readonly (keyof PlanFilters)[]>;

function readAll(): Partial<Record<PlanFilterView, unknown>> {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(PLAN_FILTERS_KEY) ?? '{}');
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    // Storage switched off, or something unreadable: nothing remembered.
    return {};
  }
}

/** The view's part of a search: only its own filter keys, the empty ones dropped. */
function planFiltersOf(view: PlanFilterView, search: PlanFilters): PlanFilters {
  const filters: PlanFilters = {};
  for (const key of KEYS[view]) if (search[key]) filters[key] = search[key];
  return filters;
}

const isEmpty = (filters: PlanFilters) => Object.keys(filters).length === 0;

/** The filter the view was last left with; empty when there is none or it is unreadable. */
function storedPlanFilters(view: PlanFilterView): PlanFilters {
  const parsed = filtersSchema.safeParse(readAll()[view]);
  return parsed.success ? planFiltersOf(view, parsed.data) : {};
}

/** Keep the view's filter (empty for none) for its next visit on this device. */
export function rememberPlanFilters(view: PlanFilterView, search: PlanFilters) {
  try {
    window.localStorage.setItem(
      PLAN_FILTERS_KEY,
      JSON.stringify({ ...readAll(), [view]: planFiltersOf(view, search) }),
    );
  } catch {
    // Private browsing or a full quota: the filter lives in the address alone.
  }
}

/**
 * For a view's `beforeLoad`: the filter to add to the address, or `undefined`
 * when the address is fine as it is. An address with a filter is remembered
 * and kept; one without is given the remembered filter, if any.
 */
export function restorePlanFilters(
  view: PlanFilterView,
  search: PlanFilters,
): PlanFilters | undefined {
  const current = planFiltersOf(view, search);
  if (!isEmpty(current)) {
    rememberPlanFilters(view, current);
    return undefined;
  }
  const stored = storedPlanFilters(view);
  return isEmpty(stored) ? undefined : stored;
}
