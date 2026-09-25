/**
 * The feature-flag model shared by the API (which evaluates), the clients
 * (which read evaluated values) and the control plane (which edits targeting).
 *
 * Two halves, deliberately kept apart:
 *
 * - A **definition** says a flag exists: its kind, owner, type and safe
 *   default. It lives in code (`catalog.ts`), so every reference is
 *   type-checked and a flag cannot be read that nobody declared.
 * - A **config** says who gets what on this deployment: the on/off switch,
 *   the targeting rules and the rollout. It lives in the database, so turning
 *   a flag on is a data change, not a deploy.
 *
 * A flag with no config serves its default. That is the answer during an
 * outage, before the first save, and for every flag a fresh install has never
 * touched — one rule instead of three.
 */

/** A resolved flag value: `true`/`false`, or the variant name of a multivariate flag. */
export type FlagValue = boolean | string;

/**
 * What a flag is for, which decides how long it may live.
 *
 * - `release` — hides unfinished work while it rolls out. Temporary: it must
 *   carry an `expiresAt`, and CI fails once that date passes.
 * - `ops` — a kill switch or operational knob. Permanent by design.
 * - `experiment` — splits traffic between variants to measure them. Temporary,
 *   and reading one records an exposure event so the result can be analysed.
 *
 * Who *may* use a feature is not a flag: that is a role (RBAC) or a plan
 * (billing). Mixing entitlement into flags is how a flag system becomes an
 * unaudited second permission system.
 */
export const FLAG_KINDS = ['release', 'ops', 'experiment'] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];

/**
 * The unit a percentage rollout is bucketed by. `organization` keeps a whole
 * workspace on the same side of a rollout — two colleagues looking at one
 * screen should see the same product — and falls back to the user when the
 * caller has no active organization.
 */
export const FLAG_BUCKET_UNITS = ['organization', 'user'] as const;
export type FlagBucketUnit = (typeof FLAG_BUCKET_UNITS)[number];

/** A calendar date, `YYYY-MM-DD`. */
export type IsoDate = `${number}-${number}-${number}`;

interface FlagDefinitionBase {
  /** One sentence: what turning it on changes. Shown in the control plane. */
  description: string;
  kind: FlagKind;
  /** The team or person accountable for removing it. */
  owner: string;
  /**
   * When a `release` or `experiment` flag should be gone. Required for both —
   * the catalog test and `pnpm check:flags` enforce it.
   */
  expiresAt?: IsoDate;
  /**
   * Whether clients may read it. A server-only flag is evaluated in the API
   * and never put on the wire.
   */
  client: boolean;
  /** Defaults to `organization`. */
  bucketBy?: FlagBucketUnit;
}

export interface BooleanFlagDefinition extends FlagDefinitionBase {
  type: 'boolean';
  /** The safe answer: what everyone gets when the flag is off or unreachable. */
  defaultValue: boolean;
}

export interface VariantFlagDefinition extends FlagDefinitionBase {
  type: 'variant';
  /** Every value the flag may take. The first is conventionally the control. */
  variants: readonly [string, ...string[]];
  /** The safe answer; must be one of `variants`. */
  defaultValue: string;
}

export type FlagDefinition = BooleanFlagDefinition | VariantFlagDefinition;

/* -------------------------------------------------------------------------- */
/*                                  Targeting                                 */
/* -------------------------------------------------------------------------- */

/**
 * What a condition can test. `segment` tests membership of a named segment
 * (see {@link FlagSegment}) rather than a request attribute.
 */
export const FLAG_ATTRIBUTES = [
  'userId',
  'organizationId',
  'email',
  'platformRole',
  'platform',
  'appVersion',
  'segment',
] as const;
export type FlagAttribute = (typeof FLAG_ATTRIBUTES)[number];

/**
 * - `in` / `not_in` — exact match against any of `values`.
 * - `ends_with` — suffix match, for email domains (`@acme.com`).
 * - `semver_gte` / `semver_lt` — version comparison against `values[0]`, for
 *   gating on a minimum mobile build. Old binaries stay installed for years, so
 *   a feature that needs new native code has to be able to say so.
 */
export const FLAG_OPERATORS = ['in', 'not_in', 'ends_with', 'semver_gte', 'semver_lt'] as const;
export type FlagOperator = (typeof FLAG_OPERATORS)[number];

export interface FlagCondition {
  attribute: FlagAttribute;
  operator: FlagOperator;
  values: string[];
}

/**
 * One arm of a percentage split. A weight is a percentage in 0.01 % steps —
 * one of the evaluator's 10 000 buckets — and an arm's weights sum to 100.
 */
export interface FlagSplitArm {
  value: FlagValue;
  weight: number;
}

/**
 * What a matched rule (or the fallthrough) serves: one value to everyone it
 * reaches, or a deterministic percentage split between values.
 */
export type FlagServe = { value: FlagValue } | { split: FlagSplitArm[] };

/** Conditions are ANDed; a rule with none matches everyone. */
export interface FlagRule {
  id: string;
  description?: string;
  conditions: FlagCondition[];
  serve: FlagServe;
}

/** A flag's targeting on this deployment. */
export interface FlagConfig {
  key: string;
  /**
   * The master switch. `false` serves the off value to everyone, whatever the
   * rules say — `false` for a boolean flag, the default variant for a
   * multivariate one (see {@link offValueOf}). Off means off, which is what
   * makes it a kill switch even for a flag whose default is `true`.
   */
  enabled: boolean;
  /** Ordered; the first rule whose conditions all hold decides. */
  rules: FlagRule[];
  /** Served when the flag is enabled and no rule matched. */
  fallthrough: FlagServe;
  /**
   * Mixed into the bucketing hash. Changing it reshuffles who lands in which
   * bucket — rarely wanted, which is why it is not derived from the key alone
   * and never changes on its own.
   */
  salt: string;
}

/**
 * A named, reusable audience (`beta-customers`, `staff`). A rule that targets
 * a segment follows it as it changes, instead of every flag carrying its own
 * copy of the same ID list.
 */
export interface FlagSegment {
  key: string;
  /** Conditions are ANDed, and may not themselves reference a segment. */
  conditions: FlagCondition[];
}

/* -------------------------------------------------------------------------- */
/*                                 Evaluation                                 */
/* -------------------------------------------------------------------------- */

export const FLAG_PLATFORMS = ['web', 'ios', 'android', 'server'] as const;
export type FlagPlatform = (typeof FLAG_PLATFORMS)[number];

/** Who a flag is being evaluated for. Every field is optional: anonymous callers have none. */
export interface FlagEvaluationContext {
  userId?: string | null;
  organizationId?: string | null;
  email?: string | null;
  /**
   * The Better Auth platform role (`user`, `admin`, `superadmin`) — not the
   * caller's role in an organization. Named for that so a rule targeting
   * `admin` cannot be read as "workspace admins".
   */
  platformRole?: string | null;
  platform?: FlagPlatform | null;
  /** The client build, semver (`1.4.0`). */
  appVersion?: string | null;
}

/**
 * Why a flag resolved the way it did — the vocabulary OpenFeature uses, so a
 * provider can be swapped in behind the same port without translating it.
 *
 * - `DEFAULT` — nothing could decide: there is no config for it on this
 *   deployment, or a split could not bucket a caller who has no user or
 *   organization.
 * - `DISABLED` — the master switch is off; the off value was served.
 * - `TARGETING_MATCH` — a rule matched.
 * - `SPLIT` — a percentage split (in a rule or the fallthrough) decided.
 * - `FALLTHROUGH` — enabled, nothing matched, the fallthrough served one value.
 * - `ERROR` — the config served a value the definition does not allow, so the
 *   default was served instead. A write should never let this happen; the
 *   evaluator does not trust that.
 */
export const FLAG_REASONS = [
  'DEFAULT',
  'DISABLED',
  'TARGETING_MATCH',
  'SPLIT',
  'FALLTHROUGH',
  'ERROR',
] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

export interface FlagEvaluation {
  key: string;
  value: FlagValue;
  reason: FlagReason;
  /** The rule that decided, when one did. */
  ruleId?: string;
}

/** What `GET /v1/feature-flags` returns: the caller's evaluated client flags. */
export interface ClientFeatureFlags {
  /**
   * Opaque version of the flag configuration the values were computed from.
   * Changes whenever any flag or segment does.
   */
  version: string;
  flags: Record<string, FlagValue>;
}
