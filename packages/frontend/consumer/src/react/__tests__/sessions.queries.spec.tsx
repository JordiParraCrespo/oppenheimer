import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import type { SessionEntity } from '../../modules/sessions/session.entity';
import { sessionsKeys, usePrefetchSession, useSession, useSessions } from '../sessions.queries';
import { fakeKernel } from './fake-kernel';

/**
 * A session the console reads as `starting` has to be read again: nothing
 * pushes its lifecycle yet, and without a second read the screen sat on the
 * provisioning pane until a reload, long after the host had opened the PTY.
 * Once it is not starting, the reads stop.
 */

// Only what the hooks read; the entity's own getters are tested beside it.
const starting = { id: 's-1', isProvisioning: true } as SessionEntity;
const open = { id: 's-1', isProvisioning: false } as SessionEntity;

function setup(service: { findById?: unknown; findAll?: unknown }, staleTime = 0) {
  const app = fakeKernel({ [TOKENS.SessionsService]: service });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  return { wrapper, queryClient };
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('useSession', () => {
  it('reads a starting session again until the host has opened it, then stops', async () => {
    const findById = vi.fn().mockResolvedValueOnce(starting).mockResolvedValue(open);
    const { wrapper } = setup({ findById });
    const { result } = renderHook(() => useSession('s-1'), { wrapper });

    await waitFor(() => expect(result.current.data?.isProvisioning).toBe(false), {
      timeout: 5_000,
    });
    const reads = findById.mock.calls.length;
    await pause(2_500);
    expect(findById).toHaveBeenCalledTimes(reads);
  }, 10_000);

  it('does not poll a session that was never starting', async () => {
    const findById = vi.fn().mockResolvedValue(open);
    const { wrapper } = setup({ findById });
    const { result } = renderHook(() => useSession('s-1'), { wrapper });

    await waitFor(() => expect(result.current.data).toBe(open));
    await pause(2_500);
    expect(findById).toHaveBeenCalledTimes(1);
  }, 10_000);
});

describe('useSessions', () => {
  it('reads the list again while any row is starting', async () => {
    const findAll = vi.fn().mockResolvedValueOnce([open, starting]).mockResolvedValue([open]);
    const { wrapper } = setup({ findAll });
    const { result } = renderHook(() => useSessions(), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(1), { timeout: 5_000 });
    expect(findAll.mock.calls.length).toBeGreaterThanOrEqual(2);
  }, 10_000);
});

/**
 * Opening a session from the sidebar should not wait on a second read of a row
 * the list already holds, and pointing at a row should read it ahead of the
 * click when the list's copy has gone stale.
 */
describe('session detail from the list', () => {
  const listed = { id: 's-1', name: 'from the list', isProvisioning: false } as SessionEntity;
  const read = { id: 's-1', name: 'from the detail', isProvisioning: false } as SessionEntity;

  it('opens on the list row with no read while the list is fresh', () => {
    const findById = vi.fn().mockResolvedValue(read);
    const { wrapper, queryClient } = setup({ findById }, 60_000);
    queryClient.setQueryData(sessionsKeys.list(), [listed]);

    const { result } = renderHook(() => useSession('s-1'), { wrapper });

    expect(result.current.data).toBe(listed);
    expect(findById).not.toHaveBeenCalled();
  });

  it('opens on a stale list row at once and reads the session behind it', async () => {
    const findById = vi.fn().mockResolvedValue(read);
    const { wrapper, queryClient } = setup({ findById }, 60_000);
    queryClient.setQueryData(sessionsKeys.list(), [listed], { updatedAt: Date.now() - 120_000 });

    const { result } = renderHook(() => useSession('s-1'), { wrapper });

    expect(result.current.data).toBe(listed);
    await waitFor(() => expect(result.current.data?.name).toBe(read.name));
    expect(findById).toHaveBeenCalledTimes(1);
  });

  it('prefetches a session the cache does not hold, once', async () => {
    const findById = vi.fn().mockResolvedValue(read);
    const { wrapper, queryClient } = setup({ findById }, 60_000);
    const { result } = renderHook(() => usePrefetchSession(), { wrapper });

    act(() => result.current('s-1'));
    act(() => result.current('s-1'));

    await waitFor(() => expect(queryClient.getQueryData(sessionsKeys.detail('s-1'))).toBe(read));
    act(() => result.current('s-1'));
    expect(findById).toHaveBeenCalledTimes(1);
  });

  it('skips the prefetch when the list row is still fresh', () => {
    const findById = vi.fn().mockResolvedValue(read);
    const { wrapper, queryClient } = setup({ findById }, 60_000);
    queryClient.setQueryData(sessionsKeys.list(), [listed]);
    const { result } = renderHook(() => usePrefetchSession(), { wrapper });

    act(() => result.current('s-1'));

    expect(findById).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(sessionsKeys.detail('s-1'))).toBe(listed);
  });

  it('stops prefetching past two reads in flight', () => {
    const findById = vi.fn().mockReturnValue(new Promise(() => {}));
    const { wrapper } = setup({ findById }, 60_000);
    const { result } = renderHook(() => usePrefetchSession(), { wrapper });

    act(() => {
      for (const id of ['s-1', 's-2', 's-3', 's-4']) result.current(id);
    });

    expect(findById).toHaveBeenCalledTimes(2);
  });
});
