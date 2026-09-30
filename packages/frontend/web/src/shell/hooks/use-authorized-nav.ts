import type { NavItem } from '../lib/nav';
import { useAbilityState } from './use-ability';
import { useShellConfig } from './use-shell';

/**
 * The nav rows the signed-in user may reach, in order. A row shows only when
 * their ability satisfies **every** policy it declares (the AND
 * `PoliciesGuard` applies), so the sidebar and command palette never offer a
 * 403.
 *
 * While permissions load, only always-visible rows show, so a gated route
 * never flashes in and out. If the query *failed*, every row shows: we do not
 * know what this reader may open, and the route guards remain the real gate.
 *
 * Takes the nav explicitly for tests; the shell calls `useAuthorizedNav()`
 * and gets the app's nav from context.
 */
export function useAuthorizedNav(nav?: readonly NavItem[]): NavItem[] {
  const shell = useShellConfig();
  const entries = nav ?? shell?.nav ?? [];
  const { ability, isUnavailable } = useAbilityState();

  return entries.filter((entry) => {
    const policies = entry.policies ?? [];
    if (policies.length === 0) return true;
    if (isUnavailable) return true;
    if (!ability) return false;
    return policies.every((policy) => ability.can(policy.action, policy.subject));
  });
}
