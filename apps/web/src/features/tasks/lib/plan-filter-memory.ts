import { searchText } from '@oppenheimer/frontend-web';
import { redirect } from '@tanstack/react-router';
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
export const PLAN_FILTERS_KEY = 'oppenheimer.plan.filters';

/** Each view's filter: the address keys it owns, and nothing else. */
const SCHEMAS = {
  board: z.object({ project: searchText, milestone: searchText }),
  milestones: z.object({ project: searchText }),
};

/** Where each view lives, for the redirect that restores its filter. */
const PATHS = { board: '/plan', milestones: '/plan/milestones' } as const;

export type PlanFilterView = keyof typeof SCHEMAS;
type PlanFilters = { project?: string; milestone?: string };

function readAll(): Partial<Record<PlanFilterView, unknown>> {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(PLAN_FILTERS_KEY) ?? '{}');
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    // Storage switched off, or something unreadable: nothing remembered.
    return {};
  }
}

/**
 * The view's part of a search, or of what storage holds: only the keys its
 * schema owns, the empty and unreadable ones dropped.
 */
function planFiltersOf(view: PlanFilterView, search: unknown): PlanFilters {
  const parsed = SCHEMAS[view].safeParse(search);
  if (!parsed.success) return {};
  return Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value));
}

const isEmpty = (filters: PlanFilters) => Object.keys(filters).length === 0;

/** The filter the view was last left with; empty when there is none or it is unreadable. */
function storedPlanFilters(view: PlanFilterView): PlanFilters {
  return planFiltersOf(view, readAll()[view]);
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
 * The filter to add to the address, or `undefined`
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

/**
 * A view's `beforeLoad`: on a navigation (not a preload, which must not
 * change what is remembered), send an address without a filter to the
 * remembered one.
 */
export function planFilterBeforeLoad(view: PlanFilterView) {
  return ({ search, preload }: { search: PlanFilters; preload: boolean }) => {
    if (preload) return;
    const restored = restorePlanFilters(view, search);
    if (restored)
      throw redirect({ to: PATHS[view], search: { ...search, ...restored }, replace: true });
  };
}
