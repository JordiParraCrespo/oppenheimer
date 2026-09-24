import { defaultQueryClientOptions, OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import type { SessionEntity } from '../../modules/sessions/session.entity';
import { sessionsKeys, useSession, useSessions } from '../sessions.queries';
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

function setup(
  service: { findById?: unknown; findAll?: unknown },
  // The console's own defaults, for the specs whose rule is its stale window.
  defaultOptions: ConstructorParameters<typeof QueryClient>[0] = {
    defaultOptions: { queries: { retry: false } },
  },
) {
  const app = fakeKernel({ [TOKENS.SessionsService]: service });
  const queryClient = new QueryClient(defaultOptions);
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
 * the list already holds: the list writes each row through to its detail.
 */
describe('session detail from the list', () => {
  const listed = { id: 's-1', name: 'from the list', isProvisioning: false } as SessionEntity;
  const read = { id: 's-1', name: 'from the detail', isProvisioning: false } as SessionEntity;
  const consoleDefaults = { defaultOptions: defaultQueryClientOptions(60_000) };

  it("writes each row it reads to that session's detail", async () => {
    const { wrapper, queryClient } = setup({ findAll: vi.fn().mockResolvedValue([listed]) });
    const { result } = renderHook(() => useSessions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(sessionsKeys.detail('s-1'))).toBe(listed);
  });

  it('opens on the list row with no read while the list is fresh', async () => {
    const findById = vi.fn().mockResolvedValue(read);
    const { wrapper } = setup(
      { findAll: vi.fn().mockResolvedValue([listed]), findById },
      consoleDefaults,
    );
    const list = renderHook(() => useSessions(), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useSession('s-1'), { wrapper });

    expect(result.current.data).toBe(listed);
    expect(findById).not.toHaveBeenCalled();
  });

  it('opens on a stale list row at once and reads the session behind it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const findById = vi.fn().mockResolvedValue(read);
      const { wrapper } = setup(
        { findAll: vi.fn().mockResolvedValue([listed]), findById },
        consoleDefaults,
      );
      const list = renderHook(() => useSessions(), { wrapper });
      await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
      vi.setSystemTime(Date.now() + 120_000);

      const { result } = renderHook(() => useSession('s-1'), { wrapper });

      expect(result.current.data).toBe(listed);
      await waitFor(() => expect(result.current.data?.name).toBe(read.name));
      expect(findById).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves a detail read after the list was asked for', async () => {
    const { wrapper, queryClient } = setup({
      findAll: vi.fn(async () => {
        // The session's own read lands while the list is still on its way.
        queryClient.setQueryData(sessionsKeys.detail('s-1'), read);
        return [listed];
      }),
    });
    const { result } = renderHook(() => useSessions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(sessionsKeys.detail('s-1'))).toBe(read);
  });
});
