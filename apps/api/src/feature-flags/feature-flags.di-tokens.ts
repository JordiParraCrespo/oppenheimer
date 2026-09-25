/**
 * DI tokens for the feature-flags module. Handlers depend on the ports these
 * name, never on the TypeORM adapters or the snapshot implementation behind
 * them.
 */
export const FEATURE_FLAG_REPOSITORY = Symbol('FEATURE_FLAG_REPOSITORY');
export const FLAG_SEGMENT_REPOSITORY = Symbol('FLAG_SEGMENT_REPOSITORY');
export const FLAG_CHANGE_REPOSITORY = Symbol('FLAG_CHANGE_REPOSITORY');
/**
 * The in-process evaluator (`FlagEvaluatorPort`). Published: `@RequireFlag`
 * reaches it from whichever module mounts the route, and any handler in the
 * app may ask it whether a flag is on.
 */
export const FLAG_EVALUATOR = Symbol('FLAG_EVALUATOR');
/**
 * The database-backed snapshot behind the evaluator (`FlagSnapshotPort`).
 * Module-internal: only this module's change handler reloads it.
 */
export const FLAG_SNAPSHOT = Symbol('FLAG_SNAPSHOT');
