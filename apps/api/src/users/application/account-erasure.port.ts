/**
 * What goes with an account, answered by whoever owns it.
 *
 * Deleting a user is this module's use case, and the user row is this
 * module's aggregate — but the hosts, sessions, projects and the personal
 * workspace that must not outlive it are other modules' tables, several of
 * them `ON DELETE RESTRICT` towards the user or the workspace. The dependency
 * runs the other way (they all know the user), so the question is a port this
 * module **declares** and each owning module **implements**, contributed
 * through `UsersModule.contributeAccountErasure` — the shape
 * `HostsModule.contributeUsage` has for the same reason.
 */
export interface AccountErasurePort {
  /** When this contribution runs; see {@link ACCOUNT_ERASURE_STEPS}. */
  readonly step: AccountErasureStep;

  /**
   * Remove, or let go of, what this module holds for `userId`. Idempotent: a
   * delete that failed part way is retried from the start, and a step that
   * already ran finds nothing left.
   */
  eraseFor(userId: string): Promise<void>;
}

/**
 * The order the contributions run in, each after the one before it:
 *
 * 1. `hosts` — unpair the account's machines, which stops the sessions on
 *    them and closes their links for good, while the rows that say where to
 *    send that still exist;
 * 2. `sessions`, then 3. `projects` — the work in the personal workspace,
 *    the two tables that refuse to lose their workspace;
 * 4. `workspace` — the personal workspace itself.
 *
 * The user row goes last, with every sign-in (they cascade from it), in the
 * handler's own write.
 */
export const ACCOUNT_ERASURE_STEPS = ['hosts', 'sessions', 'projects', 'workspace'] as const;
export type AccountErasureStep = (typeof ACCOUNT_ERASURE_STEPS)[number];
