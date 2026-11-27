/**
 * Better Auth's organization-plugin routes that write the roster, invitations
 * or teams, closed to HTTP clients (`disabledPaths`: they answer 404).
 *
 * Each one changes who belongs to an organization, or in what role, without
 * the application role that goes with it: Better Auth's own
 * `remove-member` leaves the removed member's `owner` row in `user_role`,
 * `update-member-role` leaves a demoted admin's, `accept-invitation` grants
 * none. The app's façade (`/v1/organizations/…`, `/v1/invitations/…`,
 * `/v1/workspaces/…`) is the one door, through `MembershipAccessPolicy`; its
 * gateways call `auth.api.*`, which runs the endpoint directly and never meets
 * `disabledPaths` (Better Auth checks it in its router's `onRequest` only).
 * The console calls none of these: it reaches organizations through the
 * generated API client.
 *
 * Kept open, because they write nothing a role depends on: the reads (`list`,
 * `get-full-organization`, `check-slug`, `list-members`, `get-active-member`,
 * `get-active-member-role`, `has-permission`, `get-invitation`,
 * `list-invitations`, `list-user-invitations`, `list-teams`,
 * `list-user-teams`, `list-team-members`) and the session's own selection
 * (`set-active`, `set-active-team`, which Better Auth checks against
 * membership). The role routes (`create-role` and the rest) are not mounted:
 * dynamic access control is off.
 *
 * `product/versions/mvp/08-auth.md`: workspaces are personal, with no roster,
 * invitations or teams in the console; this is the server holding the same
 * line. Opening one again is the teams slice's decision.
 */
export const CLOSED_ORGANIZATION_PATHS = [
  // Organizations: the façade's create grants the `owner` role and the
  // default workspace; delete and update are its own slices too.
  '/organization/create',
  '/organization/update',
  '/organization/delete',
  // The roster.
  '/organization/remove-member',
  '/organization/update-member-role',
  '/organization/leave',
  // Invitations.
  '/organization/invite-member',
  '/organization/accept-invitation',
  '/organization/reject-invitation',
  '/organization/cancel-invitation',
  // Teams, which the console calls workspaces.
  '/organization/create-team',
  '/organization/update-team',
  '/organization/remove-team',
  '/organization/add-team-member',
  '/organization/remove-team-member',
] as const;
