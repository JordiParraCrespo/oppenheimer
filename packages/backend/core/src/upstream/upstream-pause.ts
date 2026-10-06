/**
 * Where a pause is shared, so every replica of the API stops calling a
 * provider the moment one of them was told to. `CacheService` satisfies it.
 */
export interface UpstreamPauseStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
}

export interface UpstreamPauseOptions {
  /** How long to stop when the provider refused for its rate but did not say until when. */
  defaultPauseMs?: number;
  /** The longest pause honoured, so a malformed reset cannot switch an integration off for a day. */
  maxPauseMs?: number;
}

const DEFAULT_PAUSE_MS = 60_000;
const MAX_PAUSE_MS = 60 * 60_000;

/**
 * The "stop calling until" record for one external system, one entry per
 * bucket: whatever the provider counts against (an installation, a user's
 * token, the app itself).
 *
 * Calling a provider that already said "not until 14:05" only earns another
 * refusal, and providers that see it keep happening escalate: GitHub's
 * secondary limits lengthen, and an integration that ignores them can have its
 * App banned. So an adapter asks {@link pausedUntil} before every call, and
 * {@link pause}s a bucket the moment an answer says so.
 *
 * A pause lives in this process and, when a store is given, in the store too.
 * A store that is down never fails a call: the pause falls back to this process.
 */
export class UpstreamPause {
  private readonly local = new Map<string, number>();
  private readonly defaultPauseMs: number;
  private readonly maxPauseMs: number;

  constructor(
    private readonly system: string,
    private readonly store?: UpstreamPauseStore,
    options: UpstreamPauseOptions = {},
  ) {
    this.defaultPauseMs = options.defaultPauseMs ?? DEFAULT_PAUSE_MS;
    this.maxPauseMs = options.maxPauseMs ?? MAX_PAUSE_MS;
  }

  /** When `bucket` may be called again, or `null` when it may be called now. */
  async pausedUntil(bucket: string, now: number = Date.now()): Promise<Date | null> {
    let until = this.local.get(bucket) ?? 0;
    if (this.store) {
      try {
        until = Math.max(until, (await this.store.get<number>(this.key(bucket))) ?? 0);
      } catch {
        // The store is down: what this process knows still holds.
      }
    }
    if (until <= now) {
      this.local.delete(bucket);
      return null;
    }
    return new Date(until);
  }

  /**
   * Stop calling `bucket` until `resetAt`, or for the default pause when the
   * provider did not say, never longer than the cap. Answers the moment the
   * pause ends.
   */
  async pause(bucket: string, resetAt: Date | null, now: number = Date.now()): Promise<Date> {
    const asked = resetAt ? resetAt.getTime() : now + this.defaultPauseMs;
    // A reset already in the past still means "not right now": GitHub's clock and ours differ.
    const until = Math.min(Math.max(asked, now + 1_000), now + this.maxPauseMs);
    this.local.set(bucket, Math.max(this.local.get(bucket) ?? 0, until));
    if (this.store) {
      try {
        await this.store.set(this.key(bucket), until, Math.ceil((until - now) / 1000));
      } catch {
        // Kept in this process; the other replicas learn it from their own refusal.
      }
    }
    return new Date(until);
  }

  private key(bucket: string): string {
    return `upstream:pause:${this.system}:${bucket}`;
  }
}
