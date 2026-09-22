export abstract class CacheService {
  abstract get<T>(key: string): Promise<T | undefined>;
  abstract set<T>(key: string, value: T, ttl?: number): Promise<void>;
  abstract del(key: string): Promise<void>;
  abstract reset(): Promise<void>;
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
}
