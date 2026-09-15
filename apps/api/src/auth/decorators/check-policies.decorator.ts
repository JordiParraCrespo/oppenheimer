/**
 * Policy decorators now live in the authorization kernel
 * (`@oppenheimer/backend-authz`) so the registry, guards and containment checks can
 * share one definition of a policy rule. This module re-exports them from the
 * path the application already imports, keeping the kernel move invisible to
 * call sites.
 */
export {
  CHECK_POLICIES_KEY,
  CheckPolicies,
  NO_POLICY_KEY,
  NoPolicy,
  type PolicyRule,
} from '@oppenheimer/backend-authz';
