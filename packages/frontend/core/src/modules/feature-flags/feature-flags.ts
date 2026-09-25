import type {
  ClientFeatureFlagKey,
  FeatureFlagValueOf,
  FlagDefinition,
  FlagValue,
} from '@oppenheimer/shared/feature-flags';
import { getFlagDefinition, isValidFlagValue } from '@oppenheimer/shared/feature-flags/catalog';

/**
 * A flag's value from a served flag set, or its catalog default.
 *
 * The default covers every case where the server's answer is missing: flags
 * not loaded yet, the API unreachable on a cold start, or a value this build
 * does not recognise (a variant added after it shipped). All three want the
 * same thing — the safe answer the catalog declares — so they collapse to one
 * rule instead of three call-site checks.
 */
export function resolveFlagValue<K extends ClientFeatureFlagKey>(
  key: K,
  flags: Readonly<Record<string, FlagValue>> | undefined,
): FeatureFlagValueOf<K> {
  const definition: FlagDefinition = getFlagDefinition(key);
  const served = flags?.[key];
  return (
    isValidFlagValue(definition, served) ? served : definition.defaultValue
  ) as FeatureFlagValueOf<K>;
}

/**
 * Whether a boolean flag's resolved value is on. Only `true` is: a variant
 * flag has no off state (its control arm is a variant like any other), so it
 * is read with `useFeatureFlagValue` and branched on by name.
 */
export function isFlagEnabled(value: FlagValue | undefined): boolean {
  return value === true;
}
