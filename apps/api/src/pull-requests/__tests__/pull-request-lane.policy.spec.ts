import { describe, expect, it } from 'vitest';
import { decideLane } from '../domain/pull-request-lane.policy';

describe('the lane policy', () => {
  it('sends any change under a risky directory to the deep lane, however small', () => {
    expect(decideLane(['apps/api/src/auth/guard.ts'], 3, 1)).toEqual({
      lane: 'deep',
      reason: { code: 'risky_path', path: 'auth/' },
    });
    expect(decideLane(['.github/workflows/ci.yml'], 1, 0).lane).toBe('deep');
    expect(decideLane(['apps/api/src/migrations/1-Add.ts'], 10, 0).lane).toBe('deep');
  });

  it('sends a change over a thousand lines to the deep lane', () => {
    expect(decideLane(['src/a.ts'], 900, 101)).toEqual({
      lane: 'deep',
      reason: { code: 'large_change', lines: 1001 },
    });
  });

  it('keeps docs, tests and lockfiles quick even past the small-change size', () => {
    const paths = [
      'README.md',
      'docs/guide.md',
      'src/__tests__/a.spec.ts',
      'pnpm-lock.yaml',
      'e2e/x.ts',
      'b.test.ts',
    ];
    expect(decideLane(paths, 300, 50)).toEqual({
      lane: 'quick',
      reason: { code: 'docs_tests_config', files: 6 },
    });
  });

  it('calls a small change in few files quick, and the rest medium', () => {
    expect(decideLane(['src/a.ts', 'src/b.ts'], 100, 50).lane).toBe('quick');
    expect(decideLane(['src/a.ts', 'src/b.ts'], 100, 51)).toEqual({
      lane: 'medium',
      reason: { code: 'medium_change', lines: 151, files: 2 },
    });
    expect(decideLane(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts'], 10, 0).lane).toBe('medium');
  });

  it('does not read a code change as light because a test rides along', () => {
    expect(decideLane(['src/a.ts', 'src/a.spec.ts'], 200, 100).lane).toBe('medium');
  });

  it('never calls a change quick when GitHub did not give its files: a risky path cannot be ruled out', () => {
    expect(decideLane(null, 3, 1)).toEqual({
      lane: 'medium',
      reason: { code: 'files_unread', lines: 4 },
    });
    expect(decideLane(null, 900, 200).lane).toBe('deep');
  });
});
