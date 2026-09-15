import type { FeatureFlagValue } from './analytics.client';

/**
 * Whether a resolved flag value counts as "on".
 *
 * A multivariate flag's value is its variant name, and every variant is an
 * active state — only an explicit `false` or an absent flag is off. Keeping
 * that rule here rather than in the React hook means it's provider-independent
 * and testable without a renderer.
 *
 * `undefined` covers both "flags haven't loaded" and "no such flag", which
 * deliberately collapse to the same answer: take the control branch.
 */
export function isFlagEnabled(value: FeatureFlagValue): boolean {
  return value !== undefined && value !== false;
}
