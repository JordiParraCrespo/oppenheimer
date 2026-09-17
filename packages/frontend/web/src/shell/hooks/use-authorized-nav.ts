import type { NavItem, NavTo } from '../lib/nav';
import { useAbilityState } from './use-ability';
import { useShellConfig } from './use-shell';

/**
 * The nav rows the signed-in user may actually reach, in order. A row is shown
 * only when their ability satisfies **every** policy it declares — the same
 * AND the API's `PoliciesGuard` applies — so the sidebar and command palette
 * never offer a destination that would answer with a 403.
 *
 * While permissions are still loading we show only the always-visible rows
 * so a gated route never flashes in and then disappears. The permissions
 * query is cached across loads, so on every visit after the first there is
 * nothing to wait for.
 *
 * When that query has *failed*, every row is shown instead. Hiding the product
 * because a side request fell over would be its own lie — we do not know what
 * this reader may open, and the guards, which are the real gate, still do.
 *
 * Takes the nav explicitly so it can be tested without a shell; the shell's
 * components call `useAuthorizedNav()` and get the app's nav from context.
 */
export function useAuthorizedNav(nav?: readonly NavItem[]): NavItem[] {
  // Both are read unconditionally: hooks run in the same order whether or
  // not the caller passed its own nav.
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

/**
 * Where to send someone when the product, not the reader, picks the screen —
 * or `null` when there is nowhere honest to send them.
 *
 * The first nav row the reader's ability reaches. Ungated rows are reachable
 * while permissions are still loading, so an app whose first row is ungated
 * (the consumer sessions list is the reader's own workspace) always has a
 * landing. A gated first row waits for the answer rather than guessing.
 */
export function useLandingRoute(nav?: readonly NavItem[]): NavTo | null {
  return useAuthorizedNav(nav)[0]?.to ?? null;
}
