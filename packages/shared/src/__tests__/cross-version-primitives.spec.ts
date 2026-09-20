import { describe, expect, it } from 'vitest';
import { hostFactsSchema as wireHostFactsSchema } from '../protocol/primitives';
import { hostFactsSchema as dtoHostFactsSchema } from '../schemas/primitives';

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

/**
 * A literal sample of what `apps/runner/internal/host/domain/facts.go` marshals.
 * Copied from the struct's json tags rather than written to suit the schema — the
 * register body is the runner's to define, and this is the artefact both schemas
 * must accept.
 */
const runnerFactsJson = `{
  "platform": "macos",
  "osVersion": "15.3.1",
  "arch": "arm64",
  "hostname": "jordis-mbp",
  "user": "jordi",
  "home": "/Users/jordi",
  "root": false,
  "tools": [
    { "name": "git", "path": "/usr/bin/git", "version": "2.45.0", "required": true },
    { "name": "tmux", "path": "/opt/homebrew/bin/tmux", "version": "3.5a", "required": true },
    { "name": "claude", "required": false }
  ],
  "workspacePath": "/Users/jordi/oppenheimer-ai",
  "diskFreeBytes": 120000000000,
  "runnerVersion": "0.4.1"
}`;

const validFacts = JSON.parse(runnerFactsJson);

const invalidFacts: [string, unknown][] = [
  ['the shape no runner ever sent', { hostname: 'h', os: 'darwin', arch: 'arm64', tools: {} }],
  ['a platform outside the runner’s enum', { ...validFacts, platform: 'windows' }],
  ['a missing platform', { ...validFacts, platform: undefined }],
  ['a missing arch', { ...validFacts, arch: undefined }],
  ['a missing root flag', { ...validFacts, root: undefined }],
  ['a root flag that is not a boolean', { ...validFacts, root: 'false' }],
  ['a missing runnerVersion', { ...validFacts, runnerVersion: undefined }],
  ['a negative diskFreeBytes', { ...validFacts, diskFreeBytes: -1 }],
  ['a fractional diskFreeBytes', { ...validFacts, diskFreeBytes: 1.5 }],
  ['diskFreeBytes as a string', { ...validFacts, diskFreeBytes: '120' }],
  ['a tool with no name', { ...validFacts, tools: [{ path: '/usr/bin/git', required: true }] }],
  ['a tool with no required flag', { ...validFacts, tools: [{ name: 'git' }] }],
  ['tools as the old version map', { ...validFacts, tools: { git: '2.45.0' } }],
];

describe('hostFactsSchema agrees across the two Zod entry points', () => {
  it('both accept what the runner actually marshals', () => {
    expect(dtoHostFactsSchema.safeParse(validFacts).success).toBe(true);
    expect(wireHostFactsSchema.safeParse(validFacts).success).toBe(true);
  });

  it('both accept a nil Go slice, which marshals as null not []', () => {
    const nilTools = { ...validFacts, tools: null };
    expect(dtoHostFactsSchema.parse(nilTools).tools).toEqual([]);
    expect(wireHostFactsSchema.parse(nilTools).tools).toEqual([]);
  });

  it('both accept the empty strings Go emits for non-omitempty fields', () => {
    const sparse = { ...validFacts, workspacePath: '', hostname: '', osVersion: undefined };
    expect(dtoHostFactsSchema.safeParse(sparse).success).toBe(true);
    expect(wireHostFactsSchema.safeParse(sparse).success).toBe(true);
  });

  it('keeps every key the runner sends, stripping nothing', () => {
    const parsed = dtoHostFactsSchema.parse(validFacts);
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(validFacts).sort());
    expect(parsed.tools).toHaveLength(3);
    expect(parsed.tools[2]).toEqual({ name: 'claude', required: false });
  });

  it('derives the agents by name, since an agent is just a probed tool', () => {
    const parsed = dtoHostFactsSchema.parse(validFacts);
    expect(parsed.tools.filter((tool) => !tool.required).map((tool) => tool.name)).toEqual([
      'claude',
    ]);
    expect(parsed).not.toHaveProperty('agents');
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

  it('describes exactly the fields `facts.go` declares, and no others', () => {
    expect(Object.keys(dtoHostFactsSchema.shape).sort()).toEqual([
      'arch',
      'diskFreeBytes',
      'home',
      'hostname',
      'osVersion',
      'platform',
      'root',
      'runnerVersion',
      'tools',
      'user',
      'workspacePath',
    ]);
  });
});
