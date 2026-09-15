import { SetMetadata } from '@nestjs/common';
import type { Actions, Subjects } from '@oppenheimer/shared';

export interface PolicyRule {
  action: Actions;
  subject: Subjects;
}

export const CHECK_POLICIES_KEY = 'check_policies';
export const NO_POLICY_KEY = 'no_policy';

/**
 * Declare the capability a route requires. Checked by `PoliciesGuard` against
 * the caller's effective ability.
 */
export const CheckPolicies = (...rules: PolicyRule[]) => SetMetadata(CHECK_POLICIES_KEY, rules);

/**
 * Declare that a route intentionally requires no capability beyond being
 * authenticated.
 *
 * The reason is mandatory and is not decoration: it is what makes the
 * exemption reviewable, and greppable when someone later asks why a route is
 * open. `PoliciesGuard` rejects any route that declares neither this nor
 * `@CheckPolicies`, so the set of open routes is always an explicit list.
 */
export const NoPolicy = (reason: string) => SetMetadata(NO_POLICY_KEY, reason);

/**
 * Instance-level authorization — "may you update **this** lead" — is not a
 * decorator here.
 *
 * It is enforced at the data layer instead: `ScopedRepositoryBase` filters
 * every read by the caller's scope, so a row they cannot reach is simply not
 * returned and the handler's existing not-found path covers it. A route
 * decorator would be a second, opt-in mechanism that has to be remembered per
 * route — strictly worse than one that cannot be forgotten.
 *
 * For a check against an already-loaded row, use `canAccessRow`.
 */
