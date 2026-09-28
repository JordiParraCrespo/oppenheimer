import { describe, expect, it, vi } from 'vitest';
import { lastFailure, type TrackedMutation } from '../last-failure';

const mutation = (submittedAt: number, error: Error | null = null): TrackedMutation => ({
  error,
  submittedAt,
  reset: vi.fn(),
});

describe('lastFailure', () => {
  it('is empty before anything was submitted', () => {
    expect(lastFailure([mutation(0), mutation(0)])).toMatchObject({ error: null, index: -1 });
  });

  it('shows the failure of the mutation submitted last, and says which', () => {
    const early = mutation(1, new Error('early'));
    const late = mutation(2, new Error('late'));

    expect(lastFailure([early, late])).toMatchObject({ index: 1 });
    expect(lastFailure([late, early])).toMatchObject({ index: 0 });
    expect(lastFailure([early, late]).error?.message).toBe('late');
  });

  it('clears an earlier failure once a later mutation succeeds', () => {
    expect(lastFailure([mutation(1, new Error('early')), mutation(2)])).toMatchObject({
      error: null,
      index: -1,
    });
  });

  it('resolves a tie to the one later in the list', () => {
    expect(lastFailure([mutation(5, new Error('a')), mutation(5, new Error('b'))]).index).toBe(1);
  });

  it('dismisses every failure, so an older one does not take its place', () => {
    const older = mutation(1, new Error('older'));
    const newer = mutation(2, new Error('newer'));
    const fine = mutation(3);

    lastFailure([older, newer, fine]).dismiss();

    expect(older.reset).toHaveBeenCalledOnce();
    expect(newer.reset).toHaveBeenCalledOnce();
    expect(fine.reset).not.toHaveBeenCalled();
  });
});
