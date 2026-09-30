/**
 * What another module may ask about a workspace without seeing its tables.
 *
 * Two questions, both asked by the runner link: the workspace's slug, which is
 * a path segment on every host (`workspaces/<slug>/…`) and travels on
 * `session.create`; and whether a person is still a member, which the attach
 * socket re-checks at ticket redemption because sixty seconds is long enough
 * to have been removed. Neither answer lets the caller change anything.
 */
export interface WorkspaceLookupPort {
  /** The organization's slug, or `null` for an id that names no workspace. */
  slugOf(organizationId: string): Promise<string | null>;
  isMember(organizationId: string, userId: string): Promise<boolean>;
  /**
   * The workspaces `userId` owns — in the MVP, the one personal workspace
   * sign-up gave them. What deleting an account removes the work of.
   */
  ownedBy(userId: string): Promise<string[]>;
}
