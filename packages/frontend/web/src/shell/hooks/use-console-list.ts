import { useMatchRoute } from '@tanstack/react-router';

/** The console's lists: what the rail switches and the sidebar shows. */
export type ConsoleList = 'sessions' | 'automations';

/**
 * Which of the console's lists the address is under: `automations` for
 * everything under `/automations`, the overview and its runs, and `sessions` for
 * the rest. One predicate, asked of the router, so the rail's current item
 * and the sidebar beside it can never disagree.
 */
export function useConsoleList(): ConsoleList {
  const matchRoute = useMatchRoute();
  return matchRoute({ to: '/automations', fuzzy: true }) ? 'automations' : 'sessions';
}
