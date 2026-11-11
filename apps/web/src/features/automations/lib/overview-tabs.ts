/**
 * The overview's views, in the order its tabs show them. Each is a route, so
 * the address says which is open: the tabs read it to mark theirs, and the
 * sidebar to mark All.
 */
export const OVERVIEW_TABS = [
  { value: 'automations', to: '/automations' },
  { value: 'routines', to: '/automations/routines' },
  { value: 'runs', to: '/automations/runs' },
] as const;

export type OverviewTab = (typeof OVERVIEW_TABS)[number]['value'];

/**
 * The overview tab a pathname opens, or `undefined` off the overview. A
 * trailing slash opens the same view, as the router matches it.
 */
export function overviewTabOf(pathname: string): OverviewTab | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return OVERVIEW_TABS.find((tab) => tab.to === path)?.value;
}
