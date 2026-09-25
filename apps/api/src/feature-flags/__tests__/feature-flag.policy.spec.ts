import type { FlagDefinition } from '@oppenheimer/shared/feature-flags';
import { describe, expect, it } from 'vitest';
import { segmentProblems, targetingProblems } from '../domain/feature-flag.policy';

const variantFlag: FlagDefinition = {
  description: 'x',
  kind: 'experiment',
  owner: 'x',
  expiresAt: '2099-01-01',
  client: true,
  type: 'variant',
  variants: ['control', 'treatment'],
  defaultValue: 'control',
};

const booleanFlag: FlagDefinition = {
  description: 'x',
  kind: 'ops',
  owner: 'x',
  client: true,
  type: 'boolean',
  defaultValue: true,
};

describe('targetingProblems', () => {
  it('accepts targeting that only serves values the flag takes', () => {
    expect(
      targetingProblems(
        variantFlag,
        {
          enabled: true,
          rules: [
            {
              id: 'beta',
              conditions: [{ attribute: 'segment', operator: 'in', values: ['beta'] }],
              serve: { value: 'treatment' },
            },
          ],
          fallthrough: {
            split: [
              { value: 'control', weight: 50 },
              { value: 'treatment', weight: 50 },
            ],
          },
        },
        new Set(['beta']),
      ),
    ).toEqual([]);
  });

  it('names every problem, not just the first', () => {
    const problems = targetingProblems(
      variantFlag,
      {
        enabled: true,
        rules: [
          {
            id: 'r1',
            conditions: [
              { attribute: 'segment', operator: 'in', values: ['ghost'] },
              { attribute: 'appVersion', operator: 'semver_gte', values: ['latest'] },
              { attribute: 'email', operator: 'semver_lt', values: ['1.0.0'] },
            ],
            serve: { value: 'nope' },
          },
        ],
        fallthrough: {
          split: [
            { value: 'control', weight: 50 },
            { value: 'control', weight: 50 },
          ],
        },
      },
      new Set(),
    );

    expect(problems).toHaveLength(5);
    expect(problems.join('\n')).toMatch(/there is no segment "ghost"/);
    expect(problems.join('\n')).toMatch(/exactly one version/);
    expect(problems.join('\n')).toMatch(/only applies to appVersion/);
    expect(problems.join('\n')).toMatch(/"nope" is not a value/);
    expect(problems.join('\n')).toMatch(/same value twice/);
  });

  it('refuses a string on a boolean flag', () => {
    expect(
      targetingProblems(
        booleanFlag,
        { enabled: true, rules: [], fallthrough: { value: 'true' } },
        new Set(),
      ),
    ).toHaveLength(1);
  });
});

describe('segmentProblems', () => {
  it('refuses a segment inside a segment', () => {
    expect(
      segmentProblems([{ attribute: 'segment', operator: 'in', values: ['other'] }]),
    ).toHaveLength(1);
  });

  it('accepts plain attribute conditions', () => {
    expect(
      segmentProblems([{ attribute: 'organizationId', operator: 'in', values: ['org-1'] }]),
    ).toEqual([]);
  });
});
