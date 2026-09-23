import { describe, expect, it } from 'vitest';
import { capRepositories } from '../lib/session-options';

/**
 * One repository per session in the MVP (#56): a runner makes one worktree, so
 * the composer never sends a second. Picking another replaces the one held.
 */
describe('capRepositories', () => {
  const mobile = { id: 'i:1', branch: 'main' };
  const web = { id: 'i:2', branch: 'trunk' };

  it('keeps a single pick as it is', () => {
    expect(capRepositories([], [mobile])).toEqual([mobile]);
  });

  it('replaces the repository held with the one just picked', () => {
    expect(capRepositories([mobile], [mobile, web])).toEqual([web]);
  });

  it('lets a pick be cleared, and a branch change through', () => {
    expect(capRepositories([mobile], [])).toEqual([]);
    const moved = { ...mobile, branch: 'fix/wallet' };
    expect(capRepositories([mobile], [moved])).toEqual([moved]);
  });
});
