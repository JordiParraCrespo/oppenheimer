/**
 * Keeps the cached copies of a person's sessions true to the database.
 *
 * Better Auth caches `{ session, user }` in Redis and keeps it current for its
 * own writes only. A write the app makes to a `user` or `session` row outside
 * Better Auth (a deactivation, a profile edit, a removed membership, a
 * provisioned workspace) leaves the copy stale, and the request pipeline reads
 * the copy: a deactivated account would keep acting for the session's life. So
 * every such write is followed by one of these calls.
 */
export interface SessionCachePort {
  /**
   * Rewrite every cached session of this user from the database — the user
   * record and each session row — so the next request sees what was just
   * written. A session with no cached copy is left alone: it already answers
   * from the database.
   */
  refreshUser(userId: string): Promise<void>;

  /**
   * Drop the cached copies of every session this user holds, leaving the rows:
   * each session answers from the database until it is gone. For a write that
   * removes the rows without Better Auth — deleting the account cascades them —
   * which would otherwise leave the copies behind.
   */
  evictUser(userId: string): Promise<void>;

  /**
   * Revoke every session of this user except `keepSessionId`, rows and cached
   * copies alike, judged from the database rather than the cache's own index
   * of the user's sessions — which knows nothing of a session written before
   * the cache existed.
   */
  revokeOtherSessions(userId: string, keepSessionId: string): Promise<void>;
}
