import { describe, expect, it, vi } from 'vitest';
import { type Read, readsState, retryFailed } from '../lib/reads';

const pending = (): Read => ({
  isPending: true,
  isError: false,
  data: undefined,
  refetch: vi.fn(),
});
const failed = (): Read => ({ isPending: false, isError: true, data: undefined, refetch: vi.fn() });
const answered = (data: unknown = []): Read => ({
  isPending: false,
  isError: false,
  data,
  refetch: vi.fn(),
});

/**
 * Whether a task's page and the Plan board may draw what the projects,
 * milestones and sessions reads gave. What breaks if it drifts: a sessions
 * read that failed or has not answered reads as `[]`, and the page says "No
 * sessions" (or the board draws rows with blank project names) instead of a
 * spinner or the failure with Try again.
 */
describe('the reads a task is drawn from', () => {
  it('is pending while one read has not answered, not ready on an empty fallback', () => {
    expect(readsState([answered(), pending()])).toBe('pending');
  });

  it('is failed when a read failed with nothing to show, even beside one still pending', () => {
    expect(readsState([pending(), failed()])).toBe('failed');
  });

  it('stays ready when a refetch fails over data already drawn', () => {
    const stale: Read = { isPending: false, isError: true, data: [], refetch: vi.fn() };
    expect(readsState([answered(), stale])).toBe('ready');
  });

  it('is ready once every read has answered, empty lists included', () => {
    expect(readsState([answered([]), answered([{ id: 's' }])])).toBe('ready');
  });

  it('reads again only the reads that failed when the person taps Try again', () => {
    const ok = answered();
    const broken = failed();
    retryFailed([ok, broken]);
    expect(broken.refetch).toHaveBeenCalledOnce();
    expect(ok.refetch).not.toHaveBeenCalled();
  });
});
