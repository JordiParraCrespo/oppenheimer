import { MAX_SESSION_CHECKOUTS } from '@oppenheimer/shared/schemas/session';
import { describe, expect, it } from 'vitest';
import { capRepositories } from '../lib/session-options';

describe('capRepositories', () => {
  const repo = (n: number) => ({ id: `i:${n}`, branch: 'main' });

  it('keeps several picks, in the order they were made', () => {
    const picked = [repo(1), repo(2)];
    expect(capRepositories(picked)).toEqual(picked);
  });

  it('drops the oldest pick once one more than the cap is picked', () => {
    const full = Array.from({ length: MAX_SESSION_CHECKOUTS }, (_, i) => repo(i + 1));
    const added = repo(99);
    expect(capRepositories([...full, added])).toEqual([...full.slice(1), added]);
  });

  it('lets a pick be cleared, and a branch change through', () => {
    expect(capRepositories([])).toEqual([]);
    const moved = { ...repo(1), branch: 'fix/wallet' };
    expect(capRepositories([moved, repo(2)])).toEqual([moved, repo(2)]);
  });
});
