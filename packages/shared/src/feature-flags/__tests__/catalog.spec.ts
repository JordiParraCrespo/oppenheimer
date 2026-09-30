import { describe, expect, it } from 'vitest';
import {
  CLIENT_FEATURE_FLAG_KEYS,
  FEATURE_FLAG_KEYS,
  FEATURE_FLAGS,
  getFlagDefinition,
  isFeatureFlagKey,
  isValidFlagValue,
} from '../catalog.js';
import { updateFeatureFlagSchema } from '../schema.js';

describe('the feature-flag catalog', () => {
  it.each(FEATURE_FLAG_KEYS)('%s is well-formed', (key) => {
    const definition = getFlagDefinition(key);

    // At most 64 characters: `feature_flag."key"` is `varchar(64)`.
    expect(key).toMatch(/^[a-z][a-z0-9_]{0,63}$/);
    expect(definition.description.trim()).not.toBe('');
    expect(definition.owner.trim()).not.toBe('');
    expect(isValidFlagValue(definition, definition.defaultValue)).toBe(true);
    // Temporary kinds are debt with a due date.
    if (definition.kind !== 'ops') expect(definition.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    if (definition.type === 'variant') {
      expect(new Set(definition.variants).size).toBe(definition.variants.length);
    }
  });

  it('lists only client flags as client keys', () => {
    for (const key of CLIENT_FEATURE_FLAG_KEYS) expect(getFlagDefinition(key).client).toBe(true);
  });

  it('recognises its own keys and nothing inherited', () => {
    expect(isFeatureFlagKey('api_token_creation')).toBe(true);
    expect(isFeatureFlagKey('toString')).toBe(false);
  });

  it('keeps the kill switch for token creation live by default', () => {
    expect(FEATURE_FLAGS.api_token_creation.defaultValue).toBe(true);
  });
});

describe('updateFeatureFlagSchema', () => {
  const base = { enabled: true, rules: [], fallthrough: { value: true } };

  it('accepts a split whose weights add up to 100', () => {
    const result = updateFeatureFlagSchema.safeParse({
      ...base,
      fallthrough: {
        split: [
          { value: true, weight: 12.5 },
          { value: false, weight: 87.5 },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a split that does not', () => {
    const result = updateFeatureFlagSchema.safeParse({
      ...base,
      fallthrough: {
        split: [
          { value: true, weight: 10 },
          { value: false, weight: 80 },
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects weights that leave a bucket uncovered', () => {
    const result = updateFeatureFlagSchema.safeParse({
      ...base,
      fallthrough: {
        split: [
          { value: true, weight: 33.333 },
          { value: false, weight: 33.333 },
          { value: false, weight: 33.334 },
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it('accepts a three-way split in 0.01 % steps', () => {
    const result = updateFeatureFlagSchema.safeParse({
      ...base,
      fallthrough: {
        split: [
          { value: true, weight: 33.33 },
          { value: false, weight: 33.33 },
          { value: false, weight: 33.34 },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects duplicate rule ids', () => {
    const rule = { id: 'r1', conditions: [], serve: { value: true } };
    expect(updateFeatureFlagSchema.safeParse({ ...base, rules: [rule, rule] }).success).toBe(false);
  });
});
