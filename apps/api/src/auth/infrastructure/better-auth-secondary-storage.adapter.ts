import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { describeError } from '@oppenheimer/backend-core';
import type { BetterAuthOptions } from 'better-auth';
import type Redis from 'ioredis';

type SecondaryStorage = NonNullable<BetterAuthOptions['secondaryStorage']>;

/** Namespace of every key Better Auth writes, beside the API's `cache:`, `throttle:` and `bull:`. */
export const SESSION_STORE_KEY_PREFIX = 'ba:';

/**
 * Better Auth's verification records (`verification:<identifier>`). They stay
 * in Postgres only (`verification.storeInDatabase`), so this store neither
 * reads nor writes them: a Redis copy would only be one more place a consumed
 * reset link could still be found.
 */
const VERIFICATION_KEY_PREFIX = 'verification:';

/**
 * The Redis key a Better Auth key is stored under.
 *
 * Better Auth keys a session by its **raw token**, and the per-user index by
 * the user id. Hashing every key keeps a live secret out of the key space —
 * `SCAN`, `MONITOR`, a slow log or a key-eviction metric would otherwise print
 * bearer credentials (`.agents/rules/scopes-and-credentials.md`). The values
 * still hold the session token, exactly as the `session` table does, which is
 * why Redis must be private and password-protected (`REDIS_PASSWORD`).
 */
export function sessionStoreKey(key: string): string {
  return `${SESSION_STORE_KEY_PREFIX}${createHash('sha256').update(key, 'utf8').digest('hex')}`;
}

const logger = new Logger('BetterAuthSessionStore');

/**
 * The Redis connection sessions are cached on: the API's shared `REDIS_CLIENT`,
 * handed over at boot by {@link bindSessionStore}.
 *
 * `auth` is configured at module scope, before Nest has an injector, so the
 * store cannot take the client in a constructor. Until something binds it —
 * and in a process that never does, like the seed — the store is simply
 * absent: reads miss (Better Auth answers from Postgres), writes are skipped,
 * and nothing is ever cached for a revocation to miss.
 */
let client: Redis | null = null;

/**
 * Attach the session store to a Redis client, for as long as the returned
 * handle's owner lives. Nest calls `onModuleDestroy` on it at shutdown, before
 * `RedisModule` closes the connection, so nothing is sent on a closing client.
 */
export function bindSessionStore(redis: Redis): { onModuleDestroy(): void } {
  client = redis;
  return {
    onModuleDestroy: () => {
      if (client === redis) client = null;
    },
  };
}

function bound(key: string): Redis | null {
  return key.startsWith(VERIFICATION_KEY_PREFIX) ? null : client;
}

/**
 * The strict half of the store, for code that must know whether Redis did
 * what it was asked: every failure propagates.
 */
export const sessionStore = {
  async get(key: string): Promise<string | null> {
    return (await bound(key)?.get(sessionStoreKey(key))) ?? null;
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const redis = bound(key);
    if (!redis) return;
    if (ttlSeconds) {
      await redis.set(sessionStoreKey(key), value, 'EX', ttlSeconds);
    } else {
      await redis.set(sessionStoreKey(key), value);
    }
  },

  async delete(key: string): Promise<void> {
    await bound(key)?.del(sessionStoreKey(key));
  },
};

/**
 * Better Auth's `secondaryStorage`, over the shared Redis client.
 *
 * The failure policy is what makes a cache in front of authentication safe:
 *
 * - **A read fails open to a miss.** With `storeSessionInDatabase`, Better Auth
 *   then answers from Postgres, so a Redis outage costs a query, never a 500
 *   and never a sign-out.
 * - **A write failure is logged and dropped.** The entry is only a copy; the
 *   next read misses and falls back the same way.
 * - **A delete failure propagates.** Swallowing it would leave a revoked
 *   session answering from Redis for the rest of its life. Better Auth's
 *   revocation then fails loudly, and the caller can retry.
 */
export const betterAuthSecondaryStorage: SecondaryStorage = {
  get: (key) =>
    sessionStore.get(key).catch((error: unknown) => {
      logger.warn(
        `Session store read failed; answering from the database: ${describeError(error)}`,
      );
      return null;
    }),

  set: (key, value, ttl) =>
    sessionStore.set(key, value, ttl).catch((error: unknown) => {
      logger.warn(`Session store write failed: ${describeError(error)}`);
    }),

  delete: (key) => sessionStore.delete(key),
};
