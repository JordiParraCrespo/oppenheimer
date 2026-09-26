/**
 * What deleting an account needs done to rows other modules own.
 *
 * The workspace a person signed up with holds sessions and projects, and
 * those tables refuse to lose their organization or their creator
 * (`ON DELETE RESTRICT`) so that nothing else can delete a workspace out
 * from under its work. Deleting your own account is the one path that means
 * to, so it names the rows it removes here, in one transaction, rather than
 * relaxing the constraints for every other caller.
 */
export interface AccountErasurePort {
  /**
   * The workspaces this person is the only member of — the personal one, and
   * any other nobody else joined. They go with the account.
   */
  findSoleWorkspaces(userId: string): Promise<string[]>;

  /**
   * Whether the person left work in a workspace somebody else is also in: a
   * session they started or a GitHub installation they connected. Those rows
   * name their creator and cannot outlive them, and deleting them would take
   * work from people who did not ask.
   */
  hasSharedWork(userId: string, soleWorkspaceIds: readonly string[]): Promise<boolean>;

  /**
   * Remove the sessions (their checkouts and logs) and projects of the given
   * workspaces, then the workspaces themselves, then every sign-in the person
   * holds. The `user` row is left for the users module to delete, so its
   * domain event is raised where the aggregate lives.
   */
  eraseWorkspaces(userId: string, workspaceIds: readonly string[]): Promise<void>;
}
