import { defaultQueryClientOptions, OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import type { SessionEntity } from '../../modules/sessions/session.entity';
import { sessionsKeys, useCloseSession, useSession, useSessions } from '../sessions.queries';
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
  service: { findById?: unknown; findAll?: unknown; close?: unknown },
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
  /**
   * The entities are classes, which the query's default sharing does not look
   * into: every poll handed every reader a new object per row, and the
   * sidebar re-rendered all of its rows every two seconds.
   */
  it('keeps the rows, and the details, of a poll that changed nothing', async () => {
    // Real class instances: a plain object literal would pass on the default
    // sharing alone and prove nothing.
    class Row {
      constructor(
        public readonly id: string,
        public readonly isProvisioning: boolean,
      ) {}
    }
    const poll = (provisioning: boolean) =>
      [new Row('s-2', false), new Row('s-1', provisioning)] as unknown as SessionEntity[];
    const findAll = vi
      .fn()
      .mockResolvedValueOnce(poll(true))
      .mockResolvedValueOnce(poll(true))
      .mockResolvedValue(poll(false));
    const { wrapper, queryClient } = setup({ findAll });
    const { result } = renderHook(() => useSessions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data;
    const detail = queryClient.getQueryData(sessionsKeys.detail('s-2'));

    await waitFor(() => expect(findAll).toHaveBeenCalledTimes(2), { timeout: 5_000 });
    expect(result.current.data).toBe(first);

    await waitFor(() => expect(result.current.data?.[1]?.isProvisioning).toBe(false), {
      timeout: 5_000,
    });
    expect(result.current.data).not.toBe(first);
    expect(result.current.data?.[0]).toBe(first?.[0]);
    expect(queryClient.getQueryData(sessionsKeys.detail('s-2'))).toBe(detail);
  }, 10_000);

  it('reads the list again while any row is starting', async () => {
    const findAll = vi.fn().mockResolvedValueOnce([open, starting]).mockResolvedValue([open]);
    const { wrapper } = setup({ findAll });
    const { result } = renderHook(() => useSessions(), { wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(1), { timeout: 5_000 });
    expect(findAll.mock.calls.length).toBeGreaterThanOrEqual(2);
  }, 10_000);
});

/**
 * Delete is a close the host answers: the request comes back with the row still
 * `open`, and only a later read sees it resolved. The list leaves resolved rows
 * out and keeps reading while a close it asked for is pending.
 */
describe('a deleted session', () => {
  const live = { id: 'c-1', isProvisioning: false, isResolved: false } as SessionEntity;
  const resolved = { id: 'c-1', isProvisioning: false, isResolved: true } as SessionEntity;

  function closing(findAll: ReturnType<typeof vi.fn>) {
    const close = vi.fn().mockResolvedValue(live);
    const { wrapper } = setup({ findAll, close });
    const { result } = renderHook(() => ({ list: useSessions(), close: useCloseSession() }), {
      wrapper,
    });
    return { result, close };
  }

  it('is not listed once resolved', async () => {
    const { wrapper } = setup({ findAll: vi.fn().mockResolvedValue([resolved]) });
    const { result } = renderHook(() => useSessions(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([]));
  });

  it('is read again until its host has resolved it, then the reads stop', async () => {
    const findAll = vi
      .fn()
      .mockResolvedValueOnce([live])
      .mockResolvedValueOnce([live])
      .mockResolvedValue([resolved]);
    const { result } = closing(findAll);
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));

    result.current.close.mutate({ id: 'c-1' });
    await waitFor(() => expect(result.current.list.data).toEqual([]), { timeout: 8_000 });
    const reads = findAll.mock.calls.length;
    await pause(2_500);
    expect(findAll).toHaveBeenCalledTimes(reads);
  }, 15_000);

  it('is watched by a reader that selects less than the rows', async () => {
    const findAll = vi
      .fn()
      .mockResolvedValueOnce([live])
      .mockResolvedValueOnce([live])
      .mockResolvedValue([resolved]);
    const close = vi.fn().mockResolvedValue(live);
    const { wrapper } = setup({ findAll, close });
    const { result } = renderHook(
      () => ({
        empty: useSessions({ select: (rows) => rows.length === 0 }),
        close: useCloseSession(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.empty.data).toBe(false));

    result.current.close.mutate({ id: 'c-1' });
    await waitFor(() => expect(result.current.empty.data).toBe(true), { timeout: 8_000 });
  }, 15_000);

  it('is watched by the client that asked, not by another', async () => {
    const asked = setup({
      findAll: vi.fn().mockResolvedValue([live]),
      close: vi.fn().mockResolvedValue(live),
    });
    const other = vi.fn().mockResolvedValue([live]);
    const bystander = setup({ findAll: other });
    const mine = renderHook(() => ({ list: useSessions(), close: useCloseSession() }), {
      wrapper: asked.wrapper,
    });
    const theirs = renderHook(() => useSessions(), { wrapper: bystander.wrapper });
    await waitFor(() => expect(mine.result.current.list.data).toHaveLength(1));
    await waitFor(() => expect(theirs.result.current.data).toHaveLength(1));

    mine.result.current.close.mutate({ id: 'c-1' });
    await waitFor(() => expect(mine.result.current.close.isSuccess).toBe(true));
    // The other client reads its list for its own reasons while the watch is
    // live; that read must not start it polling for a close it never asked.
    await bystander.queryClient.refetchQueries();
    const reads = other.mock.calls.length;
    await pause(2_500);
    expect(other).toHaveBeenCalledTimes(reads);
  }, 10_000);

  it('asked again, is watched for a full window from the second ask', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      // A host that is offline: the row never resolves.
      const findAll = vi.fn().mockResolvedValue([live]);
      const { result } = closing(findAll);
      await waitFor(() => expect(result.current.list.data).toHaveLength(1));

      result.current.close.mutate({ id: 'c-1' });
      await vi.advanceTimersByTimeAsync(50_000);
      result.current.close.mutate({ id: 'c-1' });
      // Past the first ask's window, inside the second's: still reading.
      await vi.advanceTimersByTimeAsync(20_000);
      const at70 = findAll.mock.calls.length;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(findAll.mock.calls.length).toBeGreaterThan(at70);
      // Past the second window: the reads stop.
      await vi.advanceTimersByTimeAsync(40_000);
      const after = findAll.mock.calls.length;
      await vi.advanceTimersByTimeAsync(10_000);
      expect(findAll).toHaveBeenCalledTimes(after);
    } finally {
      vi.useRealTimers();
    }
  }, 15_000);
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
