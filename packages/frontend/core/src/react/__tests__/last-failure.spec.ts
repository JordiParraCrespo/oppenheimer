import { describe, expect, it, vi } from 'vitest';
import { type TrackedMutation, useLastFailure } from '../last-failure';

const mutation = (submittedAt: number, error: Error | null = null): TrackedMutation => ({
  error,
  submittedAt,
  reset: vi.fn(),
});

describe('useLastFailure', () => {
  it('is empty before anything was submitted', () => {
    expect(useLastFailure(mutation(0), mutation(0)).error).toBeNull();
  });

  it('shows the failure of the mutation submitted last', () => {
    const early = mutation(1, new Error('early'));
    const late = mutation(2, new Error('late'));

    expect(useLastFailure(early, late).error?.message).toBe('late');
    expect(useLastFailure(late, early).error?.message).toBe('late');
  });

  it('clears an earlier failure once a later mutation succeeds', () => {
    expect(useLastFailure(mutation(1, new Error('early')), mutation(2)).error).toBeNull();
  });

  it('dismisses by resetting the mutation it shows', () => {
    const early = mutation(1);
    const late = mutation(2, new Error('late'));

    useLastFailure(early, late).dismiss();

    expect(late.reset).toHaveBeenCalledOnce();
    expect(early.reset).not.toHaveBeenCalled();
  });
});
