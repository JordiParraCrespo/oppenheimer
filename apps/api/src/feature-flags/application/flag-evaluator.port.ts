import type {
  BooleanFeatureFlagKey,
  ClientFeatureFlags,
  FeatureFlagKey,
  FeatureFlagValueOf,
  FlagEvaluation,
  FlagEvaluationContext,
} from '@oppenheimer/shared/feature-flags';

/**
 * Answers "what does this flag say for this caller?" in process, without I/O.
 *
 * The one way the rest of the API asks about a flag. Behind a port so a
 * deployment that outgrows the database-backed snapshot can bind an adapter
 * for a flag vendor (LaunchDarkly, Unleash, an OpenFeature provider) to
 * `FLAG_EVALUATOR` and change nothing else — the result vocabulary is already
 * OpenFeature's.
 */
export interface FlagEvaluatorPort {
  /** One flag, with the reason it resolved as it did. */
  evaluate(key: FeatureFlagKey, context: FlagEvaluationContext): FlagEvaluation;
  /** A flag's value, typed by the catalog. */
  valueOf<K extends FeatureFlagKey>(key: K, context: FlagEvaluationContext): FeatureFlagValueOf<K>;
  /**
   * Whether a boolean flag is on. Boolean flags only: a variant flag's control
   * arm is a value like any other, so read it with `valueOf`.
   */
  isEnabled(key: BooleanFeatureFlagKey, context: FlagEvaluationContext): boolean;
  /** Every client-visible flag, evaluated — what `GET /v1/feature-flags` serves. */
  evaluateClientFlags(context: FlagEvaluationContext): ClientFeatureFlags;
}

/**
 * The database-backed snapshot behind the evaluator, as this module's own
 * change handler needs it. Not part of the evaluator contract: a vendor
 * adapter bound to `FLAG_EVALUATOR` has no Postgres snapshot to reload.
 */
export interface FlagSnapshotPort {
  /** Reload now, rather than at the next poll. Rejects when the reload fails. */
  reload(): Promise<void>;
}
