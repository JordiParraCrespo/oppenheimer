import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OppenheimerApp } from '../../di/oppenheimer-app';
import { useLogin, useLogout } from '../auth.queries';
import { OppenheimerProvider } from '../context';
import { defineMutation, withCacheOnSuccess } from '../mutations';
import { usersKeys } from '../users.queries';

/**
 * Every mutation hook takes `options`, and a caller's `onSuccess` must run
 * alongside the hook's cache update, never instead of it. Each case passes one.
 */

const SAVED = { id: 'user-1', firstName: 'Saved' };

function setup() {
  const auth = {
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
  };
  const app = { auth } as unknown as OppenheimerApp;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
    </QueryClientProvider>
  );
  return { wrapper, queryClient };
}

const invalidated = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated ?? false;

describe('withCacheOnSuccess', () => {
  it('runs the hook’s update, waits for it, then the caller’s onSuccess', async () => {
    const order: string[] = [];
    const options = withCacheOnSuccess<string, Error, void>(
      { onSuccess: () => void order.push('caller') },
      async () => {
        await Promise.resolve();
        order.push('update');
      },
    );

    await options.onSuccess?.('data', undefined, undefined, {} as never);

    expect(order).toEqual(['update', 'caller']);
  });
});

describe('a caller’s onSuccess runs alongside the cache update', () => {
  it('logout still clears the cache when the screen navigates on success', async () => {
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(usersKeys.me(), SAVED);
    const navigate = vi.fn();

    const { result } = renderHook(() => useLogout({ onSuccess: navigate }), { wrapper });
    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(navigate).toHaveBeenCalled();
    expect(queryClient.getQueryData(usersKeys.me())).toBeUndefined();
  });

  it('login still invalidates the caller', async () => {
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(usersKeys.me(), SAVED);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useLogin({ onSuccess }), { wrapper });
    act(() => result.current.mutate({ email: 'a@b.test', password: 'secret' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalled();
    expect(invalidated(queryClient, usersKeys.me())).toBe(true);
  });
});

describe('defineMutation', () => {
  const app = { things: { archive: vi.fn(async (id: string) => `archived ${id}`) } };
  const mutation = defineMutation(() => app);

  it('runs the write against the app, refreshes its reads, then the caller’s onSuccess', async () => {
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(['things', 'list'], ['a']);
    queryClient.setQueryData(['things', 'detail', 'a'], 'a');
    const useArchive = mutation({
      run: (app, id: string) => app.things.archive(id),
      invalidates: (_data, id) => [
        ['things', 'list'],
        ['things', 'detail', id],
      ],
    });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useArchive({ onSuccess }), { wrapper });
    act(() => result.current.mutate('a'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(app.things.archive).toHaveBeenCalledWith('a');
    expect(onSuccess.mock.calls[0]?.[0]).toBe('archived a');
    expect(invalidated(queryClient, ['things', 'list'])).toBe(true);
    expect(invalidated(queryClient, ['things', 'detail', 'a'])).toBe(true);
  });

  // An update that returns its refetch holds the mutation pending until it
  // lands: the screen must not move on before the list it returns to is read.
  it('waits for the update before the mutation settles', async () => {
    const { wrapper } = setup();
    const order: string[] = [];
    let land: (() => void) | undefined;
    const useArchive = mutation({
      run: (app, id: string) => app.things.archive(id),
      update: () =>
        new Promise<void>((resolve) => {
          land = () => {
            order.push('refetched');
            resolve();
          };
        }),
    });

    const { result } = renderHook(
      () => useArchive({ onSuccess: () => void order.push('caller') }),
      { wrapper },
    );
    act(() => result.current.mutate('a'));
    await waitFor(() => expect(land).toBeDefined());
    expect(result.current.isPending).toBe(true);
    expect(order).toEqual([]);

    act(() => land?.());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(order).toEqual(['refetched', 'caller']);
  });
});
