/**
 * The application role that stands for an organization membership.
 *
 * Better Auth's organization roles (`owner`, `admin`, `member`) are not what
 * the app's routes check — CASL is — so a membership only opens its
 * organization once the org-scoped application role is written beside it.
 * `owner` and `admin` on the roster become the tenant-scoped `owner` role,
 * never the global `admin`: that one is `manage all`, and assigned org-scoped
 * it would union into the caller's ability whenever the organization is active,
 * reaching every non-tenant route, including deleting platform accounts.
 *
 * `role` may be Better Auth's comma-separated list of several.
 */
export function applicationRoleFor(role: string): 'owner' | 'user' {
  return role
    .split(',')
    .map((value) => value.trim())
    .some((value) => value === 'owner' || value === 'admin')
    ? 'owner'
    : 'user';
}
