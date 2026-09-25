import { describe, expect, it } from 'vitest';
import {
  compareSemver,
  evaluateFlag,
  evaluateFlags,
  FLAG_BUCKETS,
  flagBucket,
  murmur3,
} from '../evaluate';
import type { FlagConfig, FlagDefinition, FlagSegment } from '../types';

const booleanFlag: FlagDefinition = {
  description: 'test',
  kind: 'release',
  owner: 'test',
  expiresAt: '2099-01-01',
  client: true,
  type: 'boolean',
  defaultValue: false,
};

const variantFlag: FlagDefinition = {
  description: 'test',
  kind: 'experiment',
  owner: 'test',
  expiresAt: '2099-01-01',
  client: true,
  type: 'variant',
  variants: ['control', 'treatment'],
  defaultValue: 'control',
};

function config(overrides: Partial<FlagConfig> = {}): FlagConfig {
  return {
    key: 'flag',
    enabled: true,
    rules: [],
    fallthrough: { value: false },
    salt: 'salt',
    ...overrides,
  };
}

describe('murmur3', () => {
  // Reference values from the canonical implementation (Python `mmh3`,
  // unsigned). A Go or Python service bucketing the same unit must agree.
  it.each([
    ['hello', 0, 613153351],
    ['The quick brown fox jumps over the lazy dog', 0, 776992547],
    ['', 1, 1364076727],
    ['abc', 0, 3017643002],
    ['héllo✓', 42, 1644763660],
  ])('hashes %j (seed %d) like the reference', (input, seed, expected) => {
    expect(murmur3(input, seed)).toBe(expected);
  });
});

describe('flagBucket', () => {
  it('is stable for the same unit', () => {
    expect(flagBucket('flag', 'salt', 'org-1')).toBe(flagBucket('flag', 'salt', 'org-1'));
  });

  it('is independent between flags, so the same users are not every canary', () => {
    const units = Array.from({ length: 200 }, (_, i) => `org-${i}`);
    const inFirstTenPercent = (key: string) =>
      new Set(units.filter((unit) => flagBucket(key, 'salt', unit) < FLAG_BUCKETS / 10));
    const a = inFirstTenPercent('flag_a');
    const b = inFirstTenPercent('flag_b');
    const overlap = [...a].filter((unit) => b.has(unit)).length;
    expect(overlap).toBeLessThan(Math.max(a.size, b.size));
  });

  it('spreads units roughly evenly across a 50/50 split', () => {
    const units = Array.from({ length: 10_000 }, (_, i) => `user-${i}`);
    const low = units.filter((unit) => flagBucket('flag', 'salt', unit) < FLAG_BUCKETS / 2).length;
    expect(low / units.length).toBeGreaterThan(0.47);
    expect(low / units.length).toBeLessThan(0.53);
  });
});

describe('compareSemver', () => {
  it.each([
    ['1.2.3', '1.2.3', 0],
    ['1.10.0', '1.9.9', 1],
    ['1.2', '1.2.1', -1],
    ['v2.0.0', '1.99.99', 1],
    ['1.2.3-beta.1', '1.2.3', 0],
  ])('%s vs %s → %d', (a, b, expected) => {
    expect(compareSemver(a, b)).toBe(expected);
  });

  it('refuses what is not a version', () => {
    expect(compareSemver('latest', '1.0.0')).toBeNull();
    expect(compareSemver('1.2.3.4', '1.0.0')).toBeNull();
  });
});

describe('evaluateFlag', () => {
  it('serves the default when there is no config', () => {
    expect(evaluateFlag('flag', booleanFlag, undefined, {})).toEqual({
      key: 'flag',
      value: false,
      reason: 'DEFAULT',
    });
  });

  it('serves the off value when switched off, whatever the rules say', () => {
    const result = evaluateFlag(
      'flag',
      booleanFlag,
      config({
        enabled: false,
        rules: [{ id: 'all', conditions: [], serve: { value: true } }],
        fallthrough: { value: true },
      }),
      { userId: 'u1' },
    );
    expect(result).toMatchObject({ value: false, reason: 'DISABLED' });
  });

  it('serves false when a kill switch whose default is true is pulled', () => {
    const killSwitch: FlagDefinition = { ...booleanFlag, kind: 'ops', defaultValue: true };
    expect(evaluateFlag('flag', killSwitch, undefined, {}).value).toBe(true);
    expect(
      evaluateFlag(
        'flag',
        killSwitch,
        config({ enabled: false, fallthrough: { value: true } }),
        {},
      ),
    ).toMatchObject({ value: false, reason: 'DISABLED' });
  });

  it('serves the default variant when a multivariate flag is off', () => {
    expect(
      evaluateFlag(
        'flag',
        variantFlag,
        config({ enabled: false, fallthrough: { value: 'treatment' } }),
        {},
      ).value,
    ).toBe('control');
  });

  it('lets the first matching rule decide', () => {
    const result = evaluateFlag(
      'flag',
      booleanFlag,
      config({
        rules: [
          {
            id: 'staff',
            conditions: [{ attribute: 'email', operator: 'ends_with', values: ['@ACME.com'] }],
            serve: { value: true },
          },
          { id: 'everyone', conditions: [], serve: { value: false } },
        ],
      }),
      { email: 'Ada@acme.com' },
    );
    expect(result).toEqual({
      key: 'flag',
      value: true,
      reason: 'TARGETING_MATCH',
      ruleId: 'staff',
    });
  });

  it('falls through when nothing matches', () => {
    const result = evaluateFlag(
      'flag',
      booleanFlag,
      config({
        rules: [
          {
            id: 'org',
            conditions: [{ attribute: 'organizationId', operator: 'in', values: ['org-1'] }],
            serve: { value: false },
          },
        ],
        fallthrough: { value: true },
      }),
      { organizationId: 'org-2' },
    );
    expect(result).toMatchObject({ value: true, reason: 'FALLTHROUGH' });
  });

  it('treats an absent attribute as not in any list', () => {
    const excluded = config({
      rules: [
        {
          id: 'not-blocked',
          conditions: [{ attribute: 'organizationId', operator: 'not_in', values: ['org-1'] }],
          serve: { value: true },
        },
      ],
    });
    expect(evaluateFlag('flag', booleanFlag, excluded, {}).value).toBe(true);
    expect(evaluateFlag('flag', booleanFlag, excluded, { organizationId: 'org-1' }).value).toBe(
      false,
    );
  });

  it('gates on a minimum app version', () => {
    const gated = config({
      rules: [
        {
          id: 'new-builds',
          conditions: [{ attribute: 'appVersion', operator: 'semver_gte', values: ['2.1.0'] }],
          serve: { value: true },
        },
      ],
    });
    expect(evaluateFlag('flag', booleanFlag, gated, { appVersion: '2.1.0' }).value).toBe(true);
    expect(evaluateFlag('flag', booleanFlag, gated, { appVersion: '2.0.9' }).value).toBe(false);
    expect(evaluateFlag('flag', booleanFlag, gated, {}).value).toBe(false);
  });

  it('matches a segment, and follows it as it changes', () => {
    const segments = new Map<string, FlagSegment>([
      [
        'beta',
        {
          key: 'beta',
          conditions: [{ attribute: 'organizationId', operator: 'in', values: ['org-9'] }],
        },
      ],
    ]);
    const targeted = config({
      rules: [
        {
          id: 'beta',
          conditions: [{ attribute: 'segment', operator: 'in', values: ['beta'] }],
          serve: { value: true },
        },
      ],
    });

    expect(
      evaluateFlag('flag', booleanFlag, targeted, { organizationId: 'org-9' }, segments).value,
    ).toBe(true);
    expect(
      evaluateFlag('flag', booleanFlag, targeted, { organizationId: 'org-1' }, segments).value,
    ).toBe(false);
    // An unknown segment matches nobody.
    expect(evaluateFlag('flag', booleanFlag, targeted, { organizationId: 'org-9' }).value).toBe(
      false,
    );
  });

  it('never lets a segment recurse into another', () => {
    const segments = new Map<string, FlagSegment>([
      [
        'loop',
        { key: 'loop', conditions: [{ attribute: 'segment', operator: 'in', values: ['loop'] }] },
      ],
    ]);
    const targeted = config({
      rules: [
        {
          id: 'loop',
          conditions: [{ attribute: 'segment', operator: 'in', values: ['loop'] }],
          serve: { value: true },
        },
      ],
    });
    expect(evaluateFlag('flag', booleanFlag, targeted, { userId: 'u' }, segments).value).toBe(
      false,
    );
  });

  it('splits deterministically by organization, falling back to the user', () => {
    const split = config({
      fallthrough: {
        split: [
          { value: 'control', weight: 50 },
          { value: 'treatment', weight: 50 },
        ],
      },
    });

    const first = evaluateFlag('flag', variantFlag, split, {
      organizationId: 'org-1',
      userId: 'a',
    });
    const colleague = evaluateFlag('flag', variantFlag, split, {
      organizationId: 'org-1',
      userId: 'b',
    });
    expect(first.reason).toBe('SPLIT');
    expect(colleague.value).toBe(first.value);

    const values = new Set(
      Array.from(
        { length: 50 },
        (_, i) => evaluateFlag('flag', variantFlag, split, { userId: `user-${i}` }).value,
      ),
    );
    expect(values).toEqual(new Set(['control', 'treatment']));
  });

  it('serves the default to a caller a split cannot bucket', () => {
    const split = config({
      fallthrough: {
        split: [
          { value: true, weight: 50 },
          { value: false, weight: 50 },
        ],
      },
    });
    expect(evaluateFlag('flag', booleanFlag, split, {})).toMatchObject({
      value: false,
      reason: 'DEFAULT',
    });
  });

  it('buckets everyone into an arm when the widths are thirds', () => {
    const thirds = config({
      fallthrough: {
        split: [
          { value: 'control', weight: 33.33 },
          { value: 'treatment', weight: 33.33 },
          { value: 'control', weight: 33.34 },
        ],
      },
    });
    for (let i = 0; i < 2000; i++) {
      expect(evaluateFlag('flag', variantFlag, thirds, { userId: `u${i}` }).reason).toBe('SPLIT');
    }
  });

  it('honours 0 % and 100 %', () => {
    const everyone = config({
      fallthrough: {
        split: [
          { value: true, weight: 100 },
          { value: false, weight: 0 },
        ],
      },
    });
    const nobody = config({
      fallthrough: {
        split: [
          { value: true, weight: 0 },
          { value: false, weight: 100 },
        ],
      },
    });
    for (let i = 0; i < 100; i++) {
      expect(evaluateFlag('flag', booleanFlag, everyone, { userId: `u${i}` }).value).toBe(true);
      expect(evaluateFlag('flag', booleanFlag, nobody, { userId: `u${i}` }).value).toBe(false);
    }
  });

  it('serves the default with ERROR for a value the definition does not allow', () => {
    expect(
      evaluateFlag('flag', variantFlag, config({ fallthrough: { value: 'nope' } }), {}),
    ).toMatchObject({ value: 'control', reason: 'ERROR' });
    expect(
      evaluateFlag('flag', booleanFlag, config({ fallthrough: { value: 'true' } }), {}),
    ).toMatchObject({ value: false, reason: 'ERROR' });
  });
});

describe('evaluateFlags', () => {
  it('evaluates only the requested keys, skipping undeclared ones', () => {
    const result = evaluateFlags(
      { a: booleanFlag, b: variantFlag },
      ['a', 'ghost'],
      new Map([['a', config({ key: 'a', fallthrough: { value: true } })]]),
      {},
    );
    expect(Object.keys(result)).toEqual(['a']);
    expect(result.a?.value).toBe(true);
  });
});
