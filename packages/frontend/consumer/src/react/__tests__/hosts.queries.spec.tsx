import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { type Query, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import type { HostEntity, HostPairing } from '../../modules/hosts/host.entity';
import {
  hostsKeys,
  useCurrentPairing,
  useHostPresence,
  useHosts,
  useHostsSnapshot,
  usePairingTokens,
  useRemoveHost,
  useRenameHost,
  useReplacePairing,
} from '../hosts.queries';
import { LIVE_POLL } from '../live-poll';
import { fakeKernel } from './fake-kernel';

/**
 * The host reads beyond the pairing flow (`hosts.pairing.spec.tsx`). What
 * matters: the plain list never polls and presence does; a pairing token is
 * minted once per visit and never outlives it; New token puts its answer where
 * the step reads; and a host write refreshes the host list without touching
 * the pairing subtree, whose detail mints on every refetch.
 */

class Host {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly online: boolean,
  ) {}
}
const host = (id: string, name = id, online = true) =>
  new Host(id, name, online) as unknown as HostEntity;
const pairing = (id: string) => ({ id, installCommand: `install ${id}` }) as unknown as HostPairing;

function setup(service: Record<string, unknown>) {
  const app = fakeKernel({ [TOKENS.HostsRepository]: service });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  return { wrapper, queryClient };
}

/** The interval each observer of a query asks it to poll at. */
function observerIntervals(queryClient: QueryClient, queryKey: readonly unknown[]) {
  const query = queryClient.getQueryCache().find({ queryKey, exact: true }) as Query;
  return query.observers.map((observer) => observer.options.refetchInterval);
}

describe('useHosts', () => {
  it('reads the list once and never polls it', async () => {
    const findAll = vi.fn().mockResolvedValue([host('h-1')]);
    const { wrapper, queryClient } = setup({ findAll });
    const { result } = renderHook(() => useHosts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(observerIntervals(queryClient, hostsKeys.list())).toEqual([undefined]);
  });

  it('keeps the rows of a refetch that changed nothing', async () => {
    const findAll = vi
      .fn()
      .mockResolvedValueOnce([host('h-1'), host('h-2')])
      .mockResolvedValue([host('h-1'), host('h-2', 'h-2', false)]);
    const { wrapper, queryClient } = setup({ findAll });
    const { result } = renderHook(() => useHosts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data;

    await act(() => queryClient.refetchQueries({ queryKey: hostsKeys.list() }));

    await waitFor(() => expect(result.current.data?.[1]).not.toBe(first?.[1]));
    expect(result.current.data?.[0]).toBe(first?.[0]);
  });
});

describe('useHostPresence', () => {
  it('reads the same list, polling it on the presence interval', async () => {
    const findAll = vi.fn().mockResolvedValue([host('h-1')]);
    const { wrapper, queryClient } = setup({ findAll });
    const { result } = renderHook(() => ({ presence: useHostPresence(), plain: useHosts() }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.presence.isSuccess).toBe(true));
    expect(result.current.plain.data).toBe(result.current.presence.data);
    expect(findAll).toHaveBeenCalledTimes(1);
    expect(observerIntervals(queryClient, hostsKeys.list())).toContain(
      LIVE_POLL.hostPresence.interval,
    );
  });

  it('polls only while watching, and reads one host through select', async () => {
    const findAll = vi.fn().mockResolvedValue([host('h-1', 'laptop', false), host('h-2')]);
    const { wrapper, queryClient } = setup({ findAll });
    const { result, rerender } = renderHook(
      ({ watching }: { watching: boolean }) =>
        useHostPresence({
          watching,
          select: (hosts) => hosts.find((candidate) => candidate.id === 'h-1')?.online,
        }),
      { wrapper, initialProps: { watching: true } },
    );

    await waitFor(() => expect(result.current.data).toBe(false));
    expect(observerIntervals(queryClient, hostsKeys.list())).toEqual([
      LIVE_POLL.hostPresence.interval,
    ]);

    rerender({ watching: false });
    expect(observerIntervals(queryClient, hostsKeys.list())).toEqual([false]);
  });
});

describe('useHostsSnapshot', () => {
  it('reads the cached list at call time, without fetching it', () => {
    const findAll = vi.fn();
    const { wrapper, queryClient } = setup({ findAll });
    const { result } = renderHook(() => useHostsSnapshot(), { wrapper });

    expect(result.current()).toBeUndefined();
    const rows = [host('h-1')];
    queryClient.setQueryData(hostsKeys.list(), rows);
    expect(result.current()).toBe(rows);
    expect(findAll).not.toHaveBeenCalled();
  });
});

describe('useCurrentPairing', () => {
  it('mints one token for the visit, and none survives it', async () => {
    const pair = vi.fn().mockResolvedValue(pairing('t-1'));
    const { wrapper, queryClient } = setup({ pair });
    const { result, rerender, unmount } = renderHook(() => useCurrentPairing('laptop'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data?.id).toBe('t-1'));

    rerender();
    window.dispatchEvent(new Event('focus'));
    expect(pair).toHaveBeenCalledTimes(1);
    expect(pair).toHaveBeenCalledWith('laptop');

    unmount();
    await waitFor(() =>
      expect(queryClient.getQueryData(hostsKeys.pairingDetail('laptop'))).toBeUndefined(),
    );
  });
});

describe('useReplacePairing', () => {
  it('mints a replacement for the token on screen and puts it where the step reads', async () => {
    const pair = vi.fn().mockResolvedValueOnce(pairing('t-1')).mockResolvedValue(pairing('t-2'));
    const { wrapper } = setup({ pair });
    const { result } = renderHook(
      () => ({ current: useCurrentPairing('laptop'), replace: useReplacePairing('laptop') }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.current.data?.id).toBe('t-1'));

    await act(() => result.current.replace.mutateAsync('t-1'));

    expect(pair).toHaveBeenLastCalledWith('laptop', 't-1');
    await waitFor(() => expect(result.current.current.data?.id).toBe('t-2'));
    // The replacement was written, not fetched: no third mint.
    expect(pair).toHaveBeenCalledTimes(2);
  });
});

describe('usePairingTokens', () => {
  it('reads the tokens under the pairing list key', async () => {
    const tokens = [{ id: 't-1' }];
    const { wrapper, queryClient } = setup({ pairings: vi.fn().mockResolvedValue(tokens) });
    const { result } = renderHook(() => usePairingTokens(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(hostsKeys.pairingList())).toEqual(tokens);
  });
});

describe('host writes', () => {
  const cases = [
    { name: 'remove', method: 'remove', hook: useRemoveHost, variables: 'h-1', called: ['h-1'] },
    {
      name: 'rename',
      method: 'rename',
      hook: useRenameHost,
      variables: { id: 'h-1', name: 'Studio' },
      called: ['h-1', 'Studio'],
    },
  ] as const;

  for (const { name, method, hook, variables, called } of cases) {
    it(`${name} leaves the host list stale, not the pairing tokens, then runs the caller's onSuccess`, async () => {
      const service = { [method]: vi.fn().mockResolvedValue(host('h-1', 'Studio')) };
      const { wrapper, queryClient } = setup(service);
      queryClient.setQueryData(hostsKeys.list(), [host('h-1')]);
      queryClient.setQueryData(hostsKeys.pairingList(), []);
      queryClient.setQueryData(hostsKeys.pairingDetail('laptop'), pairing('t-1'));
      let staleWhenCalled: boolean | undefined;
      const onSuccess = vi.fn(() => {
        staleWhenCalled = queryClient.getQueryState(hostsKeys.list())?.isInvalidated;
      });
      const useHook = hook as unknown as (options: { onSuccess: typeof onSuccess }) => {
        mutateAsync: (variables: unknown) => Promise<unknown>;
      };
      const { result } = renderHook(() => useHook({ onSuccess }), { wrapper });

      await act(() => result.current.mutateAsync(variables));

      expect(service[method]).toHaveBeenCalledWith(...called);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(staleWhenCalled).toBe(true);
      expect(queryClient.getQueryState(hostsKeys.pairingList())?.isInvalidated).toBe(false);
      expect(queryClient.getQueryState(hostsKeys.pairingDetail('laptop'))?.isInvalidated).toBe(
        false,
      );
    });
  }
});
