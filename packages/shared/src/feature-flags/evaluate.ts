import { isValidFlagValue } from './catalog';
import type {
  FlagCondition,
  FlagConfig,
  FlagDefinition,
  FlagEvaluation,
  FlagEvaluationContext,
  FlagSegment,
  FlagServe,
  FlagValue,
} from './types';

/**
 * The flag evaluator: definition + config + context → value. Pure, synchronous
 * and dependency-free, so the API can run it in memory on every request and a
 * test can pin every branch without a database.
 *
 * Nothing here throws. A malformed config serves the catalog default with
 * reason `ERROR` — a flag system that can take the product down is worse than
 * none.
 */

/** Buckets per rollout: 10 000, so a split is precise to 0.01 %. */
export const FLAG_BUCKETS = 10_000;

/**
 * UTF-8 bytes of a string. Written out rather than `TextEncoder` because this
 * package targets no runtime in particular — no DOM lib, no Node types — and
 * the encoding is fifteen lines.
 */
function utf8(input: string): number[] {
  const bytes: number[] = [];
  for (const char of input) {
    const code = char.codePointAt(0) as number;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

/**
 * MurmurHash3 (x86, 32-bit) over the UTF-8 bytes of `input`.
 *
 * Chosen over a cryptographic hash because bucketing needs uniformity and
 * speed, not secrecy, and over FNV because FNV distributes near-identical keys
 * (`org_1`, `org_2`) poorly. Hashing UTF-8 rather than UTF-16 code units keeps
 * the result reproducible from any language — a Go service bucketing the same
 * user must land them in the same bucket.
 */
export function murmur3(input: string, seed = 0): number {
  const bytes = utf8(input);
  const length = bytes.length;
  const blocks = length - (length % 4);
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  let h = seed >>> 0;

  for (let i = 0; i < blocks; i += 4) {
    let k =
      (bytes[i] as number) |
      ((bytes[i + 1] as number) << 8) |
      ((bytes[i + 2] as number) << 16) |
      ((bytes[i + 3] as number) << 24);
    k = Math.imul(k, c1);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, c2);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }

  // The 1–3 trailing bytes, folded in the order the reference's fall-through
  // switch does.
  const tail = length & 3;
  if (tail > 0) {
    let k = 0;
    if (tail === 3) k ^= (bytes[blocks + 2] as number) << 16;
    if (tail >= 2) k ^= (bytes[blocks + 1] as number) << 8;
    k ^= bytes[blocks] as number;
    k = Math.imul(k, c1);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, c2);
    h ^= k;
  }

  h ^= length;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * The bucket (`0`–`9999`) a unit falls in for one flag. The flag key and salt
 * are part of the input, so being in the first 10 % of one rollout says
 * nothing about any other — without that, the same unlucky users would be the
 * canaries for every release.
 */
export function flagBucket(key: string, salt: string, unit: string): number {
  return murmur3(`${key}.${salt}.${unit}`) % FLAG_BUCKETS;
}

/**
 * Compares two `major.minor.patch` versions; `null` when either is not one.
 * Pre-release and build suffixes are ignored — targeting is by release line.
 */
export function compareSemver(a: string, b: string): number | null {
  const parse = (version: string) => {
    const core = version.trim().replace(/^v/, '').split(/[-+]/)[0] ?? '';
    const parts = core.split('.');
    if (parts.length === 0 || parts.length > 3) return null;
    const numbers = parts.map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN));
    if (numbers.some(Number.isNaN)) return null;
    while (numbers.length < 3) numbers.push(0);
    return numbers;
  };
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++) {
    const diff = (left[i] as number) - (right[i] as number);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

function attributeOf(
  context: FlagEvaluationContext,
  attribute: Exclude<FlagCondition['attribute'], 'segment'>,
): string | null {
  const value = context[attribute];
  if (value === undefined || value === null || value === '') return null;
  return attribute === 'email' ? value.toLowerCase() : value;
}

function matchesCondition(
  condition: FlagCondition,
  context: FlagEvaluationContext,
  segments: ReadonlyMap<string, FlagSegment>,
  allowSegments: boolean,
): boolean {
  if (condition.attribute === 'segment') {
    // A segment may not contain a segment: one level keeps evaluation bounded
    // and a cycle impossible.
    if (!allowSegments) return false;
    const inAny = condition.values.some((key) => {
      const segment = segments.get(key);
      return segment?.conditions.every((inner) =>
        matchesCondition(inner, context, segments, false),
      );
    });
    if (condition.operator === 'in') return inAny;
    if (condition.operator === 'not_in') return !inAny;
    return false;
  }

  const actual = attributeOf(context, condition.attribute);
  const values =
    condition.attribute === 'email'
      ? condition.values.map((value) => value.toLowerCase())
      : condition.values;

  switch (condition.operator) {
    case 'in':
      return actual !== null && values.includes(actual);
    case 'not_in':
      // An absent attribute is "not in" any list: an anonymous caller is not
      // one of the excluded organizations.
      return actual === null || !values.includes(actual);
    case 'ends_with':
      return actual !== null && values.some((suffix) => actual.endsWith(suffix));
    case 'semver_gte':
    case 'semver_lt': {
      const target = values[0];
      if (actual === null || target === undefined) return false;
      const order = compareSemver(actual, target);
      if (order === null) return false;
      return condition.operator === 'semver_gte' ? order >= 0 : order < 0;
    }
    default:
      return false;
  }
}

/**
 * How many of the {@link FLAG_BUCKETS} buckets an arm covers. A weight is a
 * percentage in 0.01 % steps, so this is exact for every weight the write
 * schema accepts — and the schema checks the sum of *these* widths, so what is
 * saved is exactly what the hasher walks.
 */
export function armWidth(weight: number): number {
  return Math.round(weight * (FLAG_BUCKETS / 100));
}

/**
 * The value a unit is bucketed into for a split, or `undefined` when its
 * bucket is past the arms' combined width — which only a config written
 * around the schema can produce.
 */
function pickArm(
  serve: Extract<FlagServe, { split: unknown }>,
  bucket: number,
): FlagValue | undefined {
  let ceiling = 0;
  for (const arm of serve.split) {
    ceiling += armWidth(arm.weight);
    if (bucket < ceiling) return arm.value;
  }
  return undefined;
}

/** The unit a flag's rollout is bucketed on for this caller. */
export function bucketUnitOf(
  definition: FlagDefinition,
  context: FlagEvaluationContext,
): string | null {
  const byUser = definition.bucketBy === 'user';
  const unit = byUser ? context.userId : (context.organizationId ?? context.userId);
  return unit || null;
}

/**
 * What a switched-off flag serves: `false` for a boolean flag, whatever its
 * default — a kill switch whose default is `true` (live during a flag-service
 * outage) must still go dark when pulled — and the default variant for a
 * multivariate one, which is conventionally the control.
 */
export function offValueOf(definition: FlagDefinition): FlagValue {
  return definition.type === 'boolean' ? false : definition.defaultValue;
}

/**
 * Evaluates one flag.
 *
 * Order: no config → default; switched off → the off value; first matching rule;
 * otherwise the fallthrough. A split that cannot bucket the caller (an
 * anonymous visitor has no unit) serves the default — the one answer that is
 * safe for someone we cannot keep in a stable bucket.
 */
export function evaluateFlag(
  key: string,
  definition: FlagDefinition,
  config: FlagConfig | undefined,
  context: FlagEvaluationContext,
  segments: ReadonlyMap<string, FlagSegment> = new Map(),
): FlagEvaluation {
  const fallback = (reason: FlagEvaluation['reason'], ruleId?: string): FlagEvaluation => ({
    key,
    value: definition.defaultValue,
    reason,
    ...(ruleId ? { ruleId } : {}),
  });

  if (!config) return fallback('DEFAULT');
  if (!config.enabled) return { key, value: offValueOf(definition), reason: 'DISABLED' };

  const serve = (
    target: FlagServe,
    matched: 'TARGETING_MATCH' | 'FALLTHROUGH',
    ruleId?: string,
  ): FlagEvaluation => {
    let value: FlagValue | undefined;
    let reason: FlagEvaluation['reason'] = matched;

    if ('split' in target) {
      const unit = bucketUnitOf(definition, context);
      if (unit === null) return fallback('DEFAULT', ruleId);
      value = pickArm(target, flagBucket(key, config.salt, unit));
      if (value === undefined) return fallback('ERROR', ruleId);
      reason = 'SPLIT';
    } else {
      value = target.value;
    }

    if (!isValidFlagValue(definition, value)) return fallback('ERROR', ruleId);
    return { key, value, reason, ...(ruleId ? { ruleId } : {}) };
  };

  for (const rule of config.rules) {
    const matches = rule.conditions.every((condition) =>
      matchesCondition(condition, context, segments, true),
    );
    if (matches) return serve(rule.serve, 'TARGETING_MATCH', rule.id);
  }

  return serve(config.fallthrough, 'FALLTHROUGH');
}

/**
 * Evaluates a set of flags against one context. `configs` and `segments` are
 * keyed by flag and segment key — the in-memory snapshot the API holds.
 */
export function evaluateFlags(
  definitions: Readonly<Record<string, FlagDefinition>>,
  keys: readonly string[],
  configs: ReadonlyMap<string, FlagConfig>,
  context: FlagEvaluationContext,
  segments: ReadonlyMap<string, FlagSegment> = new Map(),
): Record<string, FlagEvaluation> {
  const result: Record<string, FlagEvaluation> = {};
  for (const key of keys) {
    const definition = definitions[key];
    if (!definition) continue;
    result[key] = evaluateFlag(key, definition, configs.get(key), context, segments);
  }
  return result;
}
