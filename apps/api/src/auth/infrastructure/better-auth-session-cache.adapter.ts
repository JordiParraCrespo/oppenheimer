import { Injectable } from '@nestjs/common';
import type { SessionCachePort } from '../application/session-cache.port';
import { auth } from './better-auth.config';
import { sessionStore } from './better-auth-secondary-storage.adapter';

/** How many of one user's session rows a refresh or eviction reads. */
const MAX_SESSIONS_PER_USER = 1_000;

/** A `session` row as Better Auth's adapter returns it, which is also what it caches. */
interface SessionRow {
  id: string;
  token: string;
  expiresAt: Date | string;
  [field: string]: unknown;
}

/**
 * {@link SessionCachePort} over Better Auth's session store.
 *
 * Every method starts from the **database** rows, not from the cache's own
 * per-user index: that index is a cache entry too, so a session it never
 * recorded — one written before the cache existed, or whose index update was
 * lost — would otherwise be missed exactly when it matters.
 *
 * Failures propagate. A refresh that cannot write the new copy evicts the old
 * one instead (the session then answers from the database); one that can do
 * neither throws, because a stale copy of a deactivated account is a session
 * that should not work and still does.
 */
@Injectable()
export class BetterAuthSessionCacheAdapter implements SessionCachePort {
  async refreshUser(userId: string): Promise<void> {
    const context = await auth.$context;
    const [user, sessions] = await Promise.all([
      context.internalAdapter.findUserById(userId),
      this.sessionRows(userId),
    ]);
    if (!user) {
      await this.evictUser(userId);
      return;
    }

    const now = Date.now();
    await Promise.all(
      sessions.map(async (session) => {
        // Not cached: the next read already comes from the database.
        if (!(await sessionStore.get(session.token))) return;

        const ttlSeconds = Math.floor((new Date(session.expiresAt).getTime() - now) / 1000);
        if (ttlSeconds <= 0) {
          await sessionStore.delete(session.token);
          return;
        }
        // The shape Better Auth writes on sign-in (`{ session, user }`), from
        // the same adapter reads, so its own `findSession` parses it unchanged.
        await sessionStore
          .set(session.token, JSON.stringify({ session, user }), ttlSeconds)
          .catch(() => sessionStore.delete(session.token));
      }),
    );
  }

  /**
   * The rows, and Better Auth's own index of the user's cached sessions too:
   * once the rows are gone (the account deletion cascades them), the index is
   * the only record of a session signed in a moment before.
   */
  async evictUser(userId: string): Promise<void> {
    const indexKey = `active-sessions-${userId}`;
    const [rows, index] = await Promise.all([this.sessionRows(userId), sessionStore.get(indexKey)]);
    const tokens = new Set(rows.map((session) => session.token));
    for (const entry of parseIndex(index)) tokens.add(entry.token);

    await Promise.all([...tokens].map((token) => sessionStore.delete(token)));
    await sessionStore.delete(indexKey);
  }

  async revokeOtherSessions(userId: string, keepSessionId: string): Promise<void> {
    const others = (await this.sessionRows(userId)).filter(
      (session) => session.id !== keepSessionId,
    );
    if (others.length === 0) return;
    const context = await auth.$context;
    // Deletes the rows; the `session.delete.before` hook in the config deletes
    // each one's cached copy first.
    await context.internalAdapter.deleteSessions(others.map((session) => session.token));
  }

  private async sessionRows(userId: string): Promise<SessionRow[]> {
    const context = await auth.$context;
    return context.adapter.findMany<SessionRow>({
      model: 'session',
      where: [{ field: 'userId', value: userId }],
      // Better Auth caps `findMany` at 100 rows unless told otherwise. A person
      // holds a handful of devices and one bridge per active credential; the
      // cap only has to be well clear of that.
      limit: MAX_SESSIONS_PER_USER,
    });
  }
}

/** Better Auth's per-user index: `[{ token, expiresAt }]`, JSON. */
function parseIndex(raw: string | null): { token: string }[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is { token: string } =>
            typeof entry === 'object' && entry !== null && typeof entry.token === 'string',
        )
      : [];
  } catch {
    return [];
  }
}
