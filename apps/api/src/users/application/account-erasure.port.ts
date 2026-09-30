/**
 * What goes with an account, answered by whoever owns it. Deleting a user is this
 * module's use case, but the hosts, sessions, projects and personal workspace that
 * must not outlive it are other modules' tables, several `ON DELETE RESTRICT` towards
 * the user or the workspace. They all know the user, so this module declares the port
 * and each owner implements it through `UsersModule.contributeAccountErasure`.
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
 * 1. `automations` — the workspace's automations and their runs, first so
 *    no trigger fires while the rest goes, and because a run names a session
 *    and a revision names a host;
 * 2. `hosts` — unpair the account's machines, which stops the sessions on
 *    them and closes their links for good, while the rows that say where to
 *    send that still exist. A session is created only on a paired host, under
 *    a lock on its row, so none is created after this;
 * 3. `sessions`, then 4. `projects` — the work in the personal workspace,
 *    the two tables that refuse to lose their workspace;
 * 5. `workspace` — the personal workspace itself.
 *
 * The user row goes last, with every sign-in (they cascade from it), in the
 * handler's own write.
 */
export const ACCOUNT_ERASURE_STEPS = [
  'automations',
  'hosts',
  'sessions',
  'projects',
  'workspace',
] as const;
export type AccountErasureStep = (typeof ACCOUNT_ERASURE_STEPS)[number];
