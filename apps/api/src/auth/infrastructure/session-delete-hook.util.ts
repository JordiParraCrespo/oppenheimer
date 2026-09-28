/**
 * How many rows Better Auth reads before a bulk delete and hands to the
 * `session.delete.before` hook: its adapter's `findMany` default
 * (`advanced.database.defaultFindManyLimit`, left at 100). The delete itself
 * has no limit, so a user-wide delete of more rows than this removes rows the
 * hook never saw.
 */
export const HOOK_ROW_CAP = 100;

/**
 * How long a user's sweep is reused when no `session.delete.after` arrives to
 * end it: a `before` hook that throws aborts the delete, and nothing else would
 * clear the entry.
 */
const SWEEP_TTL_MS = 30_000;

export interface SessionDeleteHookDeps {
  /** Every session token the user holds in Postgres, unbounded. */
  tokensOf(userId: string): Promise<string[]>;
  /** Drop one session's cached copy; a failure must propagate. */
  evict(token: string): Promise<void>;
}

export interface SessionDeleteHooks {
  before(session: { token: string; userId: string }): Promise<void>;
  after(session: { userId: string }): void;
}

/**
 * The `session.delete` database hooks that keep the Redis copy from outliving
 * its row.
 *
 * `before` drops the copy of the row it is handed. That alone is complete for a
 * single revocation and for any bulk delete of up to {@link HOOK_ROW_CAP} rows,
 * but Better Auth reads at most that many rows before a bulk delete, so for a
 * user holding more (a script's bridges, a test account) `deleteUserSessions`
 * would remove every row and evict only the first hundred copies. Better Auth
 * evicts the rest itself only when its per-user index lists them, and that
 * index is a cache entry too.
 *
 * So the first `before` of a delete also asks Postgres for all of the user's
 * rows, which still exist at that point. At or under the cap there is nothing
 * the hook cannot see, and nothing more is done. Over it, the hook cannot tell
 * which of the other rows are going, so it drops the copy of every one: a copy
 * dropped needlessly costs its session a Postgres read, a copy left behind is a
 * revoked session that still works. The sweep is shared by every `before` of
 * the same delete and forgotten on its first `after`.
 */
export function sessionDeleteHooks(deps: SessionDeleteHookDeps): SessionDeleteHooks {
  const sweeps = new Map<string, Promise<void>>();

  const forget = (userId: string, sweep: Promise<void>) => {
    if (sweeps.get(userId) === sweep) sweeps.delete(userId);
  };

  const sweepFor = (userId: string): Promise<void> => {
    const existing = sweeps.get(userId);
    if (existing) return existing;
    const sweep = (async () => {
      const tokens = await deps.tokensOf(userId);
      if (tokens.length <= HOOK_ROW_CAP) return;
      await Promise.all(tokens.map((token) => deps.evict(token)));
    })();
    sweeps.set(userId, sweep);
    // A failed sweep is not reused: the delete it belonged to is aborted, and
    // the next one sweeps again.
    sweep.catch(() => forget(userId, sweep));
    setTimeout(() => forget(userId, sweep), SWEEP_TTL_MS).unref?.();
    return sweep;
  };

  return {
    async before(session) {
      await deps.evict(session.token);
      await sweepFor(session.userId);
    },
    after(session) {
      const sweep = sweeps.get(session.userId);
      if (sweep) forget(session.userId, sweep);
    },
  };
}
