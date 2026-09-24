import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OppenheimerApp } from '../../di/oppenheimer-app';
import { useLogin, useLogout } from '../auth.queries';
import { OppenheimerProvider } from '../context';
import { withCacheOnSuccess } from '../mutations';
import { useDeleteUser, usersKeys, useUpdateUser } from '../users.queries';

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
  const users = {
    update: vi.fn().mockResolvedValue(SAVED),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const app = { auth, users } as unknown as OppenheimerApp;
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

  it('an update writes the saved row and leaves it fresh', async () => {
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(usersKeys.list(), []);
    queryClient.setQueryData(usersKeys.me(), { id: 'someone-else' });
    queryClient.setQueryData(usersKeys.permissions(), []);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useUpdateUser({ onSuccess }), { wrapper });
    act(() => result.current.mutate({ id: 'user-1', dto: { firstName: 'Saved' } }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalled();
    expect(queryClient.getQueryData(usersKeys.detail('user-1'))).toEqual(SAVED);
    // Invalidating `all` here would mark the row just written stale.
    expect(invalidated(queryClient, usersKeys.detail('user-1'))).toBe(false);
    expect(invalidated(queryClient, usersKeys.list())).toBe(true);
    // Someone else's row: the caller's entry and permissions are untouched.
    expect(queryClient.getQueryData(usersKeys.me())).toEqual({ id: 'someone-else' });
    expect(invalidated(queryClient, usersKeys.me())).toBe(false);
    expect(invalidated(queryClient, usersKeys.permissions())).toBe(false);
  });

  it('an update of the caller writes their own entry, not their permissions', async () => {
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(usersKeys.me(), { id: 'user-1', firstName: 'Before' });
    queryClient.setQueryData(usersKeys.permissions(), []);

    const { result } = renderHook(() => useUpdateUser(), { wrapper });
    act(() => result.current.mutate({ id: 'user-1', dto: { firstName: 'Saved' } }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(usersKeys.me())).toEqual(SAVED);
    expect(invalidated(queryClient, usersKeys.permissions())).toBe(false);
  });

  it('a delete drops the row and refreshes the lists', async () => {
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(usersKeys.detail('user-1'), SAVED);
    queryClient.setQueryData(usersKeys.list(), [SAVED]);
    queryClient.setQueryData(usersKeys.me(), { id: 'someone-else' });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useDeleteUser({ onSuccess }), { wrapper });
    act(() => result.current.mutate('user-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalled();
    expect(queryClient.getQueryData(usersKeys.detail('user-1'))).toBeUndefined();
    expect(invalidated(queryClient, usersKeys.list())).toBe(true);
    expect(queryClient.getQueryData(usersKeys.me())).toEqual({ id: 'someone-else' });
  });

  it('deleting the caller drops their own entry and permissions', async () => {
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(usersKeys.me(), SAVED);
    queryClient.setQueryData(usersKeys.permissions(), []);

    const { result } = renderHook(() => useDeleteUser(), { wrapper });
    act(() => result.current.mutate('user-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(usersKeys.me())).toBeUndefined();
    expect(queryClient.getQueryData(usersKeys.permissions())).toBeUndefined();
  });
});
