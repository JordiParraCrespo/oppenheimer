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

/** The overview tab a pathname opens, or `undefined` off the overview. */
export function overviewTabOf(pathname: string): OverviewTab | undefined {
  return OVERVIEW_TABS.find((tab) => tab.to === pathname)?.value;
}
