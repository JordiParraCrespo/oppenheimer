/**
 * The rows outside the membership that let a person act in an organization,
 * and that Better Auth knows nothing about: access grants naming them, and
 * sessions that still have the organization selected.
 */
export interface OrganizationAccessRepositoryPort {
  /**
   * Remove `userId`'s grants in `organizationId`, and move any session of
   * theirs that has it selected onto the organization they joined first (or
   * none), clearing the selected workspace with it.
   *
   * Written behind Better Auth's back: the caller is responsible for
   * refreshing Better Auth's cached copies of those sessions.
   */
  revokeFor(userId: string, organizationId: string): Promise<void>;
}
