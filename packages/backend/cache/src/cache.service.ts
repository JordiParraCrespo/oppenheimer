/**
 * The cache port. Values are JSON; keys are the caller's, and the
 * implementation namespaces them (see `RedisCacheService`), so a caller writes
 * `attach:<ticket>`, never `cache:attach:<ticket>`.
 *
 * There is deliberately no `reset()`/flush: the cache shares its Redis database
 * with BullMQ and the rate limiter, so "empty the cache" is one mistake away
 * from "empty every queue".
 */
export abstract class CacheService {
  abstract get<T>(key: string): Promise<T | undefined>;

  /**
   * Read several keys in one round trip, answering in the order asked, with
   * `undefined` for each key that is missing.
   */
  abstract mget<T>(keys: string[]): Promise<(T | undefined)[]>;

  abstract set<T>(key: string, value: T, ttl?: number): Promise<void>;
  abstract del(key: string): Promise<void>;

  /**
   * Answer the cached value, or run `load`, cache its result for `ttlSeconds`
   * and answer that.
   *
   * Concurrent callers for the same key share one `load` (single-flight), so an
   * entry that expires under load costs one recomputation, not one per request.
   * The guarantee is per process: with R replicas, at most R loads per expiry.
   *
   * A cache that is down never fails the caller: a failed read falls through
   * to `load`, and a failed write is ignored. A `load` that throws is not
   * cached; every waiter gets the error and the next call tries again.
   */
  abstract getOrSet<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T>;

  /**
   * Store `value` only if `key` does not exist yet, and report whether this
   * call is the one that stored it.
   *
   * This is the single-use primitive: `get`-then-`set` is two round trips that
   * two callers can both win, so anything that must happen exactly once — a
   * one-shot credential, a replay guard — cannot be built on it. The
   * implementation does it in one atomic command.
   *
   * `ttlSeconds` is required: a key that claims "this has been used" with no
   * expiry is a leak, because nothing ever removes it.
   */
  abstract setIfAbsent<T>(key: string, value: T, ttlSeconds: number): Promise<boolean>;

  /**
   * Read `key` and delete it in the same command, answering the value that was
   * there or `undefined`.
   *
   * This is the other single-use primitive, the consumer's half of
   * `setIfAbsent`: a ticket that is read and then deleted in two round trips can
   * be redeemed twice by two sockets racing on it, and a ticket is worth exactly
   * one redemption.
   */
  abstract take<T>(key: string): Promise<T | undefined>;

  /**
   * Keep the larger of the number stored at `key` and `value`, and answer the
   * one kept, in one atomic command. Only a larger value resets the TTL.
   *
   * This is the "only ever lengthen" primitive: a `get`, compare and `set` is
   * three steps another replica can interleave with, and the shorter value then
   * wins. It is what keeps a rate-limit pause from being cut short
   * (`@oppenheimer/backend-core`'s `UpstreamPause`).
   */
  abstract setMax(key: string, value: number, ttlSeconds: number): Promise<number>;
}
