import { describe, expect, it } from 'vitest';
import { hostFactsSchema as wireHostFactsSchema } from '../protocol/primitives';
import { hostFactsSchema as dtoHostFactsSchema, FIELD_BOUNDS } from '../schemas/primitives';

/**
 * The package is on two Zod entry points for as long as the JSON Schema emitter
 * needs `zod/v4`: the DTO schemas are classic `zod`, the wire is `zod/v4`. A
 * schema object cannot cross that line, so `hostFactsSchema` exists twice — once
 * for `POST /hosts/register` and once for `hello` / `heartbeat`.
 *
 * This spec is what stops that being a comment. Both are built from the same
 * `FIELD_BOUNDS`, and both are asserted to accept and reject the same inputs. If
 * one gains a field or loosens a bound, this fails.
 *
 * Delete it the day the package is on one Zod line and the duplicate is gone.
 */

const validFacts = {
  hostname: 'jordis-mbp',
  os: 'darwin',
  arch: 'arm64',
  tools: { git: '2.45.0', tmux: '3.5a', claude: null },
  agents: [
    { id: 'claude-code', version: '2.1.144' },
    { id: 'codex', version: null },
  ],
};

const invalidFacts: [string, unknown][] = [
  ['an opaque bag', { anything: 'goes' }],
  ['a missing arch', { ...validFacts, arch: undefined }],
  ['an empty hostname', { ...validFacts, hostname: '' }],
  ['an agent outside the catalog', { ...validFacts, agents: [{ id: 'cursor', version: null }] }],
  ['a non-nullable tool value', { ...validFacts, tools: { git: 42 } }],
  [
    'an over-long tool version',
    { ...validFacts, tools: { git: 'x'.repeat(FIELD_BOUNDS.toolVersion.max + 1) } },
  ],
  ['an over-long hostname', { ...validFacts, hostname: 'x'.repeat(FIELD_BOUNDS.hostFact.max + 1) }],
];

describe('hostFactsSchema agrees across the two Zod entry points', () => {
  it('both accept the same valid facts', () => {
    expect(dtoHostFactsSchema.safeParse(validFacts).success).toBe(true);
    expect(wireHostFactsSchema.safeParse(validFacts).success).toBe(true);
  });

  it('both parse to the same value', () => {
    expect(dtoHostFactsSchema.parse(validFacts)).toEqual(wireHostFactsSchema.parse(validFacts));
  });

  for (const [label, facts] of invalidFacts) {
    it(`both reject ${label}`, () => {
      expect(dtoHostFactsSchema.safeParse(facts).success).toBe(false);
      expect(wireHostFactsSchema.safeParse(facts).success).toBe(false);
    });
  }

  it('describes exactly the same fields', () => {
    expect(Object.keys(dtoHostFactsSchema.shape).sort()).toEqual(
      Object.keys(wireHostFactsSchema.shape).sort(),
    );
  });
});
