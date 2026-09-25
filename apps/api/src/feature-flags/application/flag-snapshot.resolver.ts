import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import {
  type BooleanFeatureFlagKey,
  CLIENT_FEATURE_FLAG_KEYS,
  type ClientFeatureFlags,
  evaluateFlag,
  FEATURE_FLAGS,
  type FeatureFlagKey,
  type FeatureFlagValueOf,
  type FlagConfig,
  type FlagEvaluation,
  type FlagEvaluationContext,
  type FlagSegment,
  type FlagValue,
  getFlagDefinition,
  isFeatureFlagKey,
  murmur3,
} from '@oppenheimer/shared/feature-flags';
import type { FeatureFlagRepositoryPort } from '../database/feature-flag.repository.port';
import type { FlagSegmentRepositoryPort } from '../database/flag-segment.repository.port';
import { FEATURE_FLAG_REPOSITORY, FLAG_SEGMENT_REPOSITORY } from '../feature-flags.di-tokens';
import type { FlagEvaluatorPort, FlagSnapshotPort } from './flag-evaluator.port';

/**
 * How often a replica checks whether its snapshot is stale. A change made on
 * this replica applies at once (the change event refreshes it); this bounds
 * how long every *other* replica can lag behind it.
 */
export const SNAPSHOT_POLL_INTERVAL_MS = 15_000;

interface Snapshot {
  fingerprint: string;
  version: string;
  configs: ReadonlyMap<string, FlagConfig>;
  segments: ReadonlyMap<string, FlagSegment>;
}

/**
 * Part of every version string, so a deploy that changes a default or adds a
 * flag changes the version clients see even when no row did.
 */
const CATALOG_SIGNATURE = murmur3(JSON.stringify(FEATURE_FLAGS)).toString(36);

const EMPTY: Snapshot = {
  fingerprint: '',
  version: `0.${CATALOG_SIGNATURE}`,
  configs: new Map(),
  segments: new Map(),
};

/**
 * The database-backed evaluator: every flag and segment held in memory,
 * evaluated with the pure `evaluateFlag` from `@oppenheimer/shared`.
 *
 * This is the shape Stripe described for its own flags — each process loads
 * them all at start and keeps them synced from the database — because it puts
 * no I/O on the request path: `@RequireFlag` on a hot route costs a map lookup
 * and a hash. The table is small (one row per configured flag), so holding it
 * whole is cheap; long ID lists live in segments, which are loaded the same way.
 *
 * Staleness is detected, not guessed: a replica polls a digest of every row's
 * content in each table and reloads only when it moved. The replica that made
 * a change reloads immediately.
 *
 * Failure keeps the last good snapshot. A database blip must not turn every
 * flag back to its default mid-incident — that is exactly when someone is
 * relying on a kill switch staying pulled. Before the first successful load
 * the snapshot is empty, and every flag serves its catalog default.
 */
@Injectable()
export class FlagSnapshotResolver
  implements FlagEvaluatorPort, FlagSnapshotPort, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger('FeatureFlags');
  private snapshot: Snapshot = EMPTY;
  private timer: ReturnType<typeof setInterval> | undefined;
  private inFlight: Promise<void> | undefined;
  private failing = false;

  constructor(
    @Inject(FEATURE_FLAG_REPOSITORY)
    private readonly flags: FeatureFlagRepositoryPort,
    @Inject(FLAG_SEGMENT_REPOSITORY)
    private readonly segmentRepository: FlagSegmentRepositoryPort,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.refresh();
    this.timer = setInterval(() => void this.reloadIfStale(), SNAPSHOT_POLL_INTERVAL_MS);
    // Never the reason a process stays alive.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** The version of the configuration currently being served. */
  get version(): string {
    return this.snapshot.version;
  }

  evaluate(key: FeatureFlagKey, context: FlagEvaluationContext): FlagEvaluation {
    return evaluateFlag(
      key,
      getFlagDefinition(key),
      this.snapshot.configs.get(key),
      context,
      this.snapshot.segments,
    );
  }

  valueOf<K extends FeatureFlagKey>(key: K, context: FlagEvaluationContext): FeatureFlagValueOf<K> {
    return this.evaluate(key, context).value as FeatureFlagValueOf<K>;
  }

  isEnabled(key: BooleanFeatureFlagKey, context: FlagEvaluationContext): boolean {
    return this.evaluate(key, context).value === true;
  }

  evaluateClientFlags(context: FlagEvaluationContext): ClientFeatureFlags {
    const flags: Record<string, FlagValue> = {};
    for (const key of CLIENT_FEATURE_FLAG_KEYS) flags[key] = this.evaluate(key, context).value;
    return { version: this.snapshot.version, flags };
  }

  /** Reload now, rather than at the next poll. Never rejects: a failure is logged. */
  async refresh(): Promise<void> {
    try {
      await this.reload();
    } catch (error) {
      this.reportFailure(error);
    }
  }

  /**
   * Reload now, and reject if it fails — for a caller that must know, such as
   * the change handler: a delivery whose reload failed is retried by the
   * outbox rather than marked done while this replica serves the old rules.
   */
  reload(): Promise<void> {
    // Coalesce: a burst of change events is one reload, not one each.
    this.inFlight ??= this.load().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async reloadIfStale(): Promise<void> {
    try {
      const fingerprint = await this.fingerprint();
      if (fingerprint !== this.snapshot.fingerprint) {
        await this.refresh();
      } else {
        // The database answered, so the outage is over even though nothing
        // changed during it — without this the next outage would go unlogged.
        this.recovered();
      }
    } catch (error) {
      this.reportFailure(error);
    }
  }

  private async fingerprint(): Promise<string> {
    const [flags, segments] = await Promise.all([
      this.flags.fingerprint(),
      this.segmentRepository.fingerprint(),
    ]);
    return `${flags}|${segments}`;
  }

  private async load(): Promise<void> {
    // Fingerprint first: a write landing between the two reads leaves a
    // fingerprint older than the data, which the next poll sees as stale and
    // reloads — the safe direction to be wrong in.
    const fingerprint = await this.fingerprint();
    const [flags, segments] = await Promise.all([
      this.flags.findAll(),
      this.segmentRepository.findAll(),
    ]);

    this.snapshot = {
      fingerprint,
      version: `${murmur3(fingerprint).toString(36)}.${CATALOG_SIGNATURE}`,
      // A row whose key has left the catalog is ignored: the code no longer
      // reads it, and the database cannot invent a flag.
      configs: new Map(
        flags
          .filter((flag) => isFeatureFlagKey(flag.key))
          .map((flag) => [flag.key, flag.toConfig()]),
      ),
      segments: new Map(segments.map((segment) => [segment.key, segment.toSegment()])),
    };

    this.recovered();
  }

  private recovered(): void {
    if (this.failing) this.logger.log('Feature flag snapshot recovered');
    this.failing = false;
  }

  /** Once per outage, not once per poll. */
  private reportFailure(error: unknown): void {
    if (this.failing) return;
    this.failing = true;
    this.logger.warn(
      `Feature flag snapshot could not be refreshed; serving the last good one: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
