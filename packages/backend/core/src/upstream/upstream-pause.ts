import { Logger } from '@nestjs/common';

/**
 * Where a pause is shared, so every replica of the API stops calling a
 * provider the moment one of them was told to. `CacheService` satisfies it.
 */
export interface UpstreamPauseStore {
  get<T>(key: string): Promise<T | undefined>;
  /**
   * Keep the larger of the stored number and `value`, in one atomic step, and
   * answer the one kept. A pause only ever lengthens: a replica that learned a
   * shorter reset (clock skew, a missing header) must not cut another's short.
   */
  setMax(key: string, value: number, ttlSeconds: number): Promise<number>;
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
 * bucket: whatever the provider counts against (an installation, a user, the
 * app itself, a project).
 *
 * Calling a provider that already said "not until 14:05" only earns another
 * refusal, and providers that see it keep happening escalate: GitHub's
 * secondary limits lengthen, and an integration that ignores them can have its
 * App banned. `UpstreamLimiter` asks {@link pausedUntil} before every call and
 * {@link pause}s a bucket the moment an answer says so.
 *
 * A pause lives in this process and in the store. A store that is down never
 * fails a call: the pause still holds in this process, and the failure is
 * logged, because then the other replicas will not learn it.
 */
export class UpstreamPause {
  private readonly logger = new Logger(UpstreamPause.name);
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
      } catch (error) {
        this.storeFailed('read', bucket, error);
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
   * provider did not say, never longer than the cap and never shorter than a
   * pause already held. Answers the moment the pause ends.
   */
  async pause(bucket: string, resetAt: Date | null, now: number = Date.now()): Promise<Date> {
    const asked = resetAt ? resetAt.getTime() : now + this.defaultPauseMs;
    // A reset already in the past still means "not right now": their clock and ours differ.
    let until = Math.min(Math.max(asked, now + 1_000), now + this.maxPauseMs);
    until = Math.max(until, this.local.get(bucket) ?? 0);
    if (this.store) {
      try {
        until = Math.max(
          until,
          await this.store.setMax(this.key(bucket), until, Math.ceil((until - now) / 1000)),
        );
      } catch (error) {
        this.storeFailed('write', bucket, error);
      }
    }
    this.local.set(bucket, until);
    return new Date(until);
  }

  private storeFailed(action: 'read' | 'write', bucket: string, error: unknown): void {
    this.logger.warn({
      message: `Could not ${action} the shared ${this.system} rate-limit pause; holding it in this process only`,
      bucket,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  private key(bucket: string): string {
    return `upstream:pause:${this.system}:${bucket}`;
  }
}
