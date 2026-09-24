import type { FlagDefinition, FlagValue } from './types';

/**
 * The feature-flag catalog — every flag the code may read, and the only place
 * one is declared.
 *
 * A key here is what `useFlag`, `FeatureFlagsService.isEnabled` and
 * `@RequireFlag` accept, so a typo is a compile error and deleting a flag
 * breaks every reader that still names it. The database holds only targeting
 * for these keys; it cannot invent a flag the code does not know about, and a
 * row whose key has left this file is ignored.
 *
 * Adding one:
 *
 * 1. Add the entry. Pick the `kind` honestly — a `release` flag is debt with a
 *    due date (`expiresAt`), and `pnpm check:flags` fails CI once it passes.
 * 2. Choose `defaultValue` as the *safe* answer: what every user gets before
 *    anyone saves targeting and whenever the flag service cannot answer. For a
 *    new feature that is `false`; for a kill switch guarding something already
 *    live, `true` — an outage should not take the feature down with it.
 *    Switching a flag *off* is different: it serves `false` (or the default
 *    variant), so a pulled kill switch goes dark whatever its default.
 * 3. Set `client: false` unless a client renders something differently for it.
 *    A server-only flag never goes over the wire.
 *
 * Removing one: delete the entry and every reader the compiler then names.
 */
export const FEATURE_FLAGS = {
  /**
   * Kill switch for minting API tokens. Live by default; switching it off stops
   * new tokens being created (the API refuses, the web app hides the button)
   * without touching tokens that already exist.
   */
  api_token_creation: {
    description: 'Allow users to create new personal API tokens.',
    kind: 'ops',
    owner: 'platform',
    type: 'boolean',
    defaultValue: true,
    client: true,
    bucketBy: 'user',
  },
} as const satisfies Record<string, FlagDefinition>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

type Catalog = typeof FEATURE_FLAGS;

/**
 * Keys of the boolean flags — the only kind that can gate a capability. A
 * variant flag has no "off" arm (its control is a variant like any other), so
 * asking whether one is enabled has no honest answer.
 */
export type BooleanFeatureFlagKey = {
  [K in FeatureFlagKey]: Catalog[K]['type'] extends 'boolean' ? K : never;
}[FeatureFlagKey];

/** Keys a client may read. */
export type ClientFeatureFlagKey = {
  [K in FeatureFlagKey]: Catalog[K]['client'] extends true ? K : never;
}[FeatureFlagKey];

/**
 * The value type of one flag: `boolean` for a boolean flag, the union of its
 * variant names for a multivariate one.
 */
export type FeatureFlagValueOf<K extends FeatureFlagKey> = Catalog[K] extends {
  type: 'variant';
  variants: readonly (infer V extends string)[];
}
  ? V
  : boolean;

/** Every declared key, in catalog order. */
export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

/** The keys clients may read, in catalog order. */
export const CLIENT_FEATURE_FLAG_KEYS = FEATURE_FLAG_KEYS.filter(
  (key) => (FEATURE_FLAGS[key] as FlagDefinition).client,
) as ClientFeatureFlagKey[];

export function isFeatureFlagKey(key: string): key is FeatureFlagKey {
  return Object.hasOwn(FEATURE_FLAGS, key);
}

/** The definition behind a key, widened so callers can branch on `type`. */
export function getFlagDefinition(key: FeatureFlagKey): FlagDefinition {
  return FEATURE_FLAGS[key] as FlagDefinition;
}

/** Whether `value` is one a flag of this definition may take. */
export function isValidFlagValue(definition: FlagDefinition, value: unknown): value is FlagValue {
  if (definition.type === 'boolean') return typeof value === 'boolean';
  return typeof value === 'string' && definition.variants.includes(value);
}

/**
 * The catalog defaults for the client flags — what a client renders before
 * the first response arrives, and what it keeps rendering if it never does.
 */
export function defaultClientFlagValues(): Record<ClientFeatureFlagKey, FlagValue> {
  return Object.fromEntries(
    CLIENT_FEATURE_FLAG_KEYS.map((key) => [key, getFlagDefinition(key).defaultValue]),
  ) as Record<ClientFeatureFlagKey, FlagValue>;
}

/**
 * Flags of a temporary kind whose `expiresAt` is on or before `today`
 * (`YYYY-MM-DD`). What `pnpm check:flags` fails on.
 */
export function expiredFlags(
  today: string,
  catalog: Record<string, FlagDefinition> = FEATURE_FLAGS,
): string[] {
  return Object.entries(catalog)
    .filter(
      ([, definition]) =>
        definition.kind !== 'ops' &&
        definition.expiresAt !== undefined &&
        definition.expiresAt <= today,
    )
    .map(([key]) => key);
}
